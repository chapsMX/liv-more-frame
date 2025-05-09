import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    // Extraer el user_fid y date de los query parameters
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');
    
    // Si no se proporciona una fecha, usar la fecha de hoy
    const today = new Date();
    const dateParam = searchParams.get('date');
    const date = dateParam || today.toISOString().split('T')[0]; // formato YYYY-MM-DD

    if (!user_fid) {
      return NextResponse.json({ 
        success: false, 
        error: 'user_fid es requerido' 
      }, { status: 400 });
    }

    console.log(`[API Rook Physical] Obteniendo datos para user_fid: ${user_fid}, fecha: ${date}`);

    // Obtener rook_user_id desde la tabla user_connections
    const userResult = await sql`
      SELECT rook_user_id 
      FROM user_connections
      WHERE user_fid = ${user_fid} AND rook_user_id IS NOT NULL
      LIMIT 1
    `;

    if (userResult.length === 0 || !userResult[0].rook_user_id) {
      console.error(`[API Rook Physical] No se encontró rook_user_id para user_fid: ${user_fid}`);
      return NextResponse.json({ 
        success: false, 
        error: 'Usuario no conectado a Rook' 
      }, { status: 404 });
    }

    const rookUserId = userResult[0].rook_user_id;
    
    // Obtener credenciales de Rook desde variables de entorno
    const rookClientUuid = process.env.ROOK_CLIENT_UUID;
    const rookClientSecret = process.env.ROOK_CLIENT_SECRET;

    if (!rookClientUuid || !rookClientSecret) {
      console.error('[API Rook Physical] Faltan credenciales de Rook en variables de entorno');
      return NextResponse.json({ 
        success: false, 
        error: 'Error de configuración del servidor' 
      }, { status: 500 });
    }

    // URL para obtener el resumen de actividad física
    const url = `https://api.rook-connect.review/v2/processed_data/physical_health/summary?user_id=${rookUserId}&date=${date}`;
    
    console.log(`[API Rook Physical] Haciendo solicitud a: ${url}`);

    // Preparar credenciales para Basic Authentication
    const credentials = Buffer.from(`${rookClientUuid}:${rookClientSecret}`).toString('base64');
    
    // Hacer la solicitud a la API de Rook
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      }
    });

    // Si no hay contenido (status 204), devolver valores por defecto
    if (response.status === 204) {
      console.log(`[API Rook Physical] No hay datos disponibles para la fecha: ${date}`);
      return NextResponse.json({
        success: true,
        message: 'No hay datos disponibles para esta fecha',
        steps: 0,
        calories: 0
      });
    }
    
    // Si hay error en la API de Rook
    if (!response.ok) {
      console.error(`[API Rook Physical] Error en API de Rook: ${response.status}`);
      return NextResponse.json({ 
        success: false, 
        error: `Error en API de Rook: ${response.status}` 
      }, { status: response.status });
    }

    // Procesar la respuesta de Rook
    const data = await response.json();
    console.log(`[API Rook Physical] Datos recibidos de Rook:`, JSON.stringify(data, null, 2));

    // Extraer los datos de interés (pasos y calorías)
    let steps = 0;
    let calories = 0;

    try {
      // Navegar por la estructura de datos para obtener pasos y calorías
      if (data.physical_health && data.physical_health.summary) {
        const summary = data.physical_health.summary;
        
        if (summary.steps !== undefined) {
          steps = summary.steps;
        } else if (summary.steps_int !== undefined) {
          steps = summary.steps_int;
        }
        
        if (summary.active_calories !== undefined) {
          calories = summary.active_calories;
        } else if (summary.active_calories_int !== undefined) {
          calories = summary.active_calories_int;
        }
      }

      // Guardar los datos en la tabla daily_activities
      await updateDailyActivities(user_fid, date, { steps, calories });

      return NextResponse.json({
        success: true,
        steps,
        calories
      });
    } catch (parseError) {
      console.error('[API Rook Physical] Error procesando datos de Rook:', parseError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error procesando datos de Rook' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[API Rook Physical] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}

// Función auxiliar para actualizar daily_activities
async function updateDailyActivities(user_fid: string, date: string, data: { steps?: number; calories?: number }) {
  try {
    // Verificar si ya existe un registro para esta fecha y usuario
    const existingRecord = await sql`
      SELECT id FROM daily_activities
      WHERE user_fid = ${user_fid} AND date = ${date}
      LIMIT 1
    `;

    if (existingRecord.length > 0) {
      // Actualizar el registro existente
      const updateQuery = [];
      const updateValues: any[] = [];

      if (data.steps !== undefined) {
        updateQuery.push('steps = ?');
        updateValues.push(data.steps);
      }

      if (data.calories !== undefined) {
        updateQuery.push('calories = ?');
        updateValues.push(data.calories);
      }

      if (updateQuery.length > 0) {
        updateQuery.push('updated_at = CURRENT_TIMESTAMP');

        // Construir la consulta de actualización de manera segura sin usar unsafe
        if (data.steps !== undefined && data.calories !== undefined) {
          await sql`
            UPDATE daily_activities
            SET steps = ${data.steps}, calories = ${data.calories}, updated_at = CURRENT_TIMESTAMP
            WHERE user_fid = ${user_fid} AND date = ${date}
          `;
        } else if (data.steps !== undefined) {
          await sql`
            UPDATE daily_activities
            SET steps = ${data.steps}, updated_at = CURRENT_TIMESTAMP
            WHERE user_fid = ${user_fid} AND date = ${date}
          `;
        } else if (data.calories !== undefined) {
          await sql`
            UPDATE daily_activities
            SET calories = ${data.calories}, updated_at = CURRENT_TIMESTAMP
            WHERE user_fid = ${user_fid} AND date = ${date}
          `;
        }
      }
    } else {
      // Crear un nuevo registro
      await sql`
        INSERT INTO daily_activities
          (user_fid, date, steps, calories, created_at, updated_at)
        VALUES
          (${user_fid}, ${date}, ${data.steps || 0}, ${data.calories || 0}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
    }

    console.log(`[API Rook Physical] Datos guardados en daily_activities para user_fid: ${user_fid}, fecha: ${date}`);
    return true;
  } catch (error) {
    console.error('[API Rook Physical] Error guardando datos en daily_activities:', error);
    return false;
  }
} 