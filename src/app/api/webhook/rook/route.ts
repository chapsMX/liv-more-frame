import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

/**
 * Endpoint para verificar que el webhook está configurado correctamente
 */
export async function GET(request: Request) {
  console.log('🔍 [Webhook] Recibiendo solicitud GET para prueba');
  console.log('📡 [Webhook] URL completa:', request.url);
  
  return NextResponse.json({
    success: true,
    message: "Webhook endpoint configurado correctamente",
    timestamp: new Date().toISOString(),
    request_url: request.url
  });
}

/**
 * Endpoint principal del webhook para recibir datos de Rook
 */
export async function POST(request: Request) {
  console.log('📥 [Webhook] Recibiendo datos de Rook...');
  console.log('📡 [Webhook] URL completa:', request.url);
  console.log('🔑 [Webhook] Headers:', JSON.stringify(Object.fromEntries([...request.headers]), null, 2));
  
  try {
    const data = await request.json();
    console.log('📦 [Webhook] Datos recibidos:', JSON.stringify(data, null, 2));

    // Extraer el user_id
    const user_id = data.user_id;
    if (!user_id) {
      console.error('❌ [Webhook] Falta user_id en los datos');
      return NextResponse.json(
        { success: false, error: 'Missing user_id' },
        { status: 400 }
      );
    }

    // Determinar el tipo de datos recibidos
    let dataType = 'unknown';
    if (data.physical_health?.summary) {
      dataType = 'physical_summary';
    } else if (data.sleep_health?.summary) {
      dataType = 'sleep_summary';
    }

    console.log('🏷️ [Webhook] Tipo de datos identificado:', dataType);

    // Procesar los datos según su tipo
    try {
      switch (dataType) {
        case 'physical_summary':
          await processPhysicalData(data);
          break;
        case 'sleep_summary':
          await processSleepData(data);
          break;
        default:
          console.log('⚠️ [Webhook] Tipo de datos no reconocido:', dataType);
          // Guardar los datos sin procesar para análisis posterior
          await logWebhookData(user_id, dataType, data);
      }

      return NextResponse.json({ 
        success: true,
        message: `Datos de tipo ${dataType} procesados correctamente`
      });

    } catch (processingError: any) {
      console.error('❌ [Webhook] Error procesando datos:', processingError);
      await logWebhookData(user_id, dataType, data, processingError.message);
      
      // Retornamos 200 para que Rook no reintente el envío
      return NextResponse.json({
        success: true,
        warning: `Error interno procesando datos: ${processingError.message}`
      });
    }

  } catch (error) {
    console.error('❌ [Webhook] Error general:', error);
    return NextResponse.json({
      success: true,
      warning: 'Error interno procesando la solicitud'
    });
  }
}

/**
 * Procesa los datos físicos recibidos
 */
async function processPhysicalData(data: any) {
  const { user_id } = data;
  const date = extractDate(data);
  
  // Extraer datos del resumen físico
  const physicalSummary = data.physical_health?.summary?.physical_summary;
  const steps = physicalSummary?.distance?.steps_int || 0;
  const calories = physicalSummary?.calories?.calories_expenditure_kcal_float || 0;
  const distance = physicalSummary?.distance?.distance_meters_float || 0;

  // Obtener el user_fid asociado
  const userFid = await getUserFidFromRookId(user_id);
  if (!userFid) {
    throw new Error(`No se encontró user_fid para user_id: ${user_id}`);
  }

  // Actualizar o crear registro en daily_activities
  await updateDailyActivity(userFid, date, {
    steps,
    calories,
    distance_meters: Math.round(distance)
  });
}

/**
 * Procesa los datos de sueño recibidos
 */
async function processSleepData(data: any) {
  const { user_id } = data;
  const date = extractDate(data);
  
  // Extraer datos del resumen de sueño
  const sleepSummary = data.sleep_health?.summary?.sleep_summary;
  const sleepDurationSeconds = sleepSummary?.duration?.sleep_duration_seconds_int || 0;
  const sleepDurationHours = Math.round((sleepDurationSeconds / 3600) * 10) / 10;

  // Obtener el user_fid asociado
  const userFid = await getUserFidFromRookId(user_id);
  if (!userFid) {
    throw new Error(`No se encontró user_fid para user_id: ${user_id}`);
  }

  // Actualizar o crear registro en daily_activities
  await updateDailyActivity(userFid, date, {
    sleep_hours: sleepDurationHours
  });
}

/**
 * Extrae la fecha de los datos recibidos
 */
function extractDate(data: any): string {
  // Intentar obtener la fecha de diferentes ubicaciones en los datos
  let date = data.date;
  
  if (!date) {
    // Buscar en metadata de resumen físico
    const physicalMetadata = data.physical_health?.summary?.physical_summary?.metadata;
    if (physicalMetadata?.datetime_string) {
      date = physicalMetadata.datetime_string.split('T')[0];
    }
    // Buscar en metadata de resumen de sueño
    const sleepMetadata = data.sleep_health?.summary?.sleep_summary?.metadata;
    if (!date && sleepMetadata?.datetime_string) {
      date = sleepMetadata.datetime_string.split('T')[0];
    }
  }

  // Si aún no hay fecha, usar la fecha actual
  if (!date) {
    date = new Date().toISOString().split('T')[0];
  }

  return date;
}

/**
 * Obtiene el user_fid asociado a un user_id de Rook
 */
async function getUserFidFromRookId(rookUserId: string): Promise<string | null> {
  try {
    const result = await sql`
      SELECT user_fid 
      FROM user_connections 
      WHERE rook_user_id = ${rookUserId}
      LIMIT 1
    `;
    
    return result.length > 0 ? result[0].user_fid : null;
  } catch (error) {
    console.error('❌ [Webhook] Error buscando user_fid:', error);
    return null;
  }
}

/**
 * Actualiza o crea un registro en daily_activities
 */
async function updateDailyActivity(userFid: string, date: string, data: any) {
  try {
    // Verificar si existe un registro para esa fecha
    const existingRecord = await sql`
      SELECT id FROM daily_activities
      WHERE user_fid = ${userFid} AND date = ${date}
      LIMIT 1
    `;

    if (existingRecord.length > 0) {
      // Para actualización, actualizamos cada campo individualmente
      for (const [key, value] of Object.entries(data)) {
        if (key === 'steps') {
          await sql`
            UPDATE daily_activities
            SET steps = ${value}, updated_at = CURRENT_TIMESTAMP
            WHERE user_fid = ${userFid} AND date = ${date}
          `;
        } else if (key === 'calories') {
          await sql`
            UPDATE daily_activities
            SET calories = ${value}, updated_at = CURRENT_TIMESTAMP
            WHERE user_fid = ${userFid} AND date = ${date}
          `;
        } else if (key === 'distance_meters') {
          await sql`
            UPDATE daily_activities
            SET distance_meters = ${value}, updated_at = CURRENT_TIMESTAMP
            WHERE user_fid = ${userFid} AND date = ${date}
          `;
        } else if (key === 'sleep_hours') {
          await sql`
            UPDATE daily_activities
            SET sleep_hours = ${value}, updated_at = CURRENT_TIMESTAMP
            WHERE user_fid = ${userFid} AND date = ${date}
          `;
        }
      }
    } else {
      // Para inserción, usamos una consulta específica según los datos disponibles
      if ('steps' in data || 'calories' in data || 'distance_meters' in data) {
        await sql`
          INSERT INTO daily_activities
            (user_fid, date, steps, calories, distance_meters, created_at, updated_at)
          VALUES
            (${userFid}, ${date}, ${data.steps || 0}, ${data.calories || 0}, ${data.distance_meters || 0}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
      } else if ('sleep_hours' in data) {
        await sql`
          INSERT INTO daily_activities
            (user_fid, date, sleep_hours, created_at, updated_at)
          VALUES
            (${userFid}, ${date}, ${data.sleep_hours}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
      }
    }
  } catch (error) {
    console.error('❌ [Webhook] Error actualizando daily_activities:', error);
    throw error;
  }
}

/**
 * Registra los datos recibidos para análisis posterior
 */
async function logWebhookData(userId: string, type: string, data: any, errorMessage?: string) {
  try {
    const date = extractDate(data);
    
    await sql`
      INSERT INTO webhook_logs
        (user_id, type, data_date, raw_data, error_message, created_at)
      VALUES
        (${userId}, ${type}, ${date}, ${JSON.stringify(data)}, ${errorMessage}, CURRENT_TIMESTAMP)
    `;
  } catch (error) {
    console.error('❌ [Webhook] Error guardando log:', error);
  }
} 