import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Caché para datos semanales - Reducir consultas repetitivas
const weeklyDataCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export async function GET(request: Request) {
  try {
    // Extraer parámetros
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date') || new Date().toISOString().split('T')[0];
    const force_refresh = searchParams.get('force_refresh') === 'true';

    if (!user_fid) {
      return NextResponse.json({ 
        success: false, 
        error: 'user_fid es requerido' 
      }, { status: 400 });
    }

    if (!start_date) {
      return NextResponse.json({ 
        success: false, 
        error: 'start_date es requerido' 
      }, { status: 400 });
    }

    console.log(`[Weekly Data] Obteniendo datos para user_fid: ${user_fid} desde ${start_date} hasta ${end_date}`);
    
    // Clave para la caché
    const cacheKey = `${user_fid}-${start_date}-${end_date}`;
    const now = Date.now();
    
    // Verificar caché
    if (!force_refresh) {
      const cachedData = weeklyDataCache.get(cacheKey);
      if (cachedData && (now - cachedData.timestamp < CACHE_TTL)) {
        console.log(`[Weekly Data] Usando datos en caché para user_fid: ${user_fid}`);
        return NextResponse.json({
          success: true,
          data: cachedData.data,
          cached: true
        });
      }
    }
    
    // Buscar primero en la base de datos local
    let weeklyData = [];
    
    try {
      // Primero intentamos obtener los datos de nuestra tabla daily_activities
      const dbData = await sql`
        SELECT date, steps, calories, sleep_hours
        FROM daily_activities
        WHERE user_fid = ${user_fid} 
        AND date BETWEEN ${start_date} AND ${end_date}
        ORDER BY date ASC
      `;
      
      if (dbData.length > 0) {
        console.log(`[Weekly Data] Encontrados ${dbData.length} días en la base de datos local`);
        weeklyData = dbData;
        
        // Guardar en caché y devolver
        weeklyDataCache.set(cacheKey, { data: weeklyData, timestamp: now });
        
        return NextResponse.json({
          success: true,
          data: weeklyData,
          source: 'local_db'
        });
      }
    } catch (dbError) {
      console.error('[Weekly Data] Error consultando la base de datos local:', dbError);
      // Continuamos para intentar obtener datos de Rook
    }
    
    // Si no hay datos locales, necesitamos obtener el rook_user_id para consultar la API
    let rookUserId;
    
    try {
      // Primero intentar obtener de rook_connection
      const connectionResult = await sql`
        SELECT rook_user_id FROM rook_connection
        WHERE user_fid = ${user_fid} AND rook_user_id IS NOT NULL
        LIMIT 1
      `;

      if (connectionResult.length > 0 && connectionResult[0].rook_user_id) {
        rookUserId = connectionResult[0].rook_user_id;
        console.log(`[Weekly Data] Usando rook_user_id de rook_connection: ${rookUserId}`);
      } else {
        // Fallback a user_connections para compatibilidad
        const legacyResult = await sql`
          SELECT rook_user_id FROM user_connections
          WHERE user_fid = ${user_fid} AND rook_user_id IS NOT NULL
          LIMIT 1
        `;
        
        if (legacyResult.length === 0 || !legacyResult[0].rook_user_id) {
          console.log(`[Weekly Data] No se encontró conexión con Rook para user_fid: ${user_fid}`);
          
          // Si no hay datos en la API ni locales, crear datos de ejemplo para desarrollo
          if (process.env.NODE_ENV !== 'production') {
            const demoData = generateDemoData(start_date, end_date);
            
            // Guardar en caché y devolver
            weeklyDataCache.set(cacheKey, { data: demoData, timestamp: now });
            
            return NextResponse.json({
              success: true,
              data: demoData,
              source: 'demo_data'
            });
          }
          
          return NextResponse.json({ 
            success: false, 
            error: 'Usuario no conectado a Rook' 
          }, { status: 404 });
        }
        
        rookUserId = legacyResult[0].rook_user_id;
        console.log(`[Weekly Data] Usando rook_user_id de tabla legacy: ${rookUserId}`);
      }
    } catch (dbError) {
      console.error(`[Weekly Data] Error consultando la base de datos:`, dbError);
      
      // Usar user_fid como rookUserId alternativo
      rookUserId = user_fid;
      console.log(`[Weekly Data] Usando user_fid como rookUserId alternativo: ${rookUserId}`);
    }
    
    // Obtener credenciales de Rook
    const rookClientUuid = process.env.ROOK_CLIENT_UUID;
    const rookClientSecret = process.env.ROOK_CLIENT_SECRET;

    if (!rookClientUuid || !rookClientSecret) {
      return NextResponse.json({ 
        success: false, 
        error: 'Credenciales de Rook no configuradas' 
      }, { status: 500 });
    }
    
    try {
      // Preparamos los datos para recopilar información diaria
      weeklyData = [];
      
      // Vamos a obtener datos día por día dentro del rango de fechas
      let currentDate = new Date(start_date);
      const endDateObj = new Date(end_date);
      
      // Preparamos las credenciales para autenticación
      const auth = Buffer.from(`${rookClientUuid}:${rookClientSecret}`).toString('base64');
      
      while (currentDate <= endDateObj) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        try {
          // Consultamos datos físicos
          console.log(`[Weekly Data] Consultando datos físicos para ${dateStr}`);
          const physicalUrl = `https://api.rook-connect.review/v2/processed_data/physical_health/summary?user_id=${rookUserId}&date=${dateStr}`;
          const physicalResponse = await fetch(physicalUrl, {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json'
            }
          });
          
          // Consultamos datos de sueño
          console.log(`[Weekly Data] Consultando datos de sueño para ${dateStr}`);
          const sleepUrl = `https://api.rook-connect.review/v2/processed_data/sleep/summary?user_id=${rookUserId}&date=${dateStr}`;
          const sleepResponse = await fetch(sleepUrl, {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json'
            }
          });
          
          let steps = 0;
          let calories = 0;
          let sleep_hours = 0;
          
          // Procesar datos físicos
          if (physicalResponse.status === 200) {
            const physicalData = await physicalResponse.json();
            steps = physicalData?.physical_health?.summary?.steps || 0;
            calories = physicalData?.physical_health?.summary?.active_calories || 0;
          }
          
          // Procesar datos de sueño
          if (sleepResponse.status === 200) {
            const sleepData = await sleepResponse.json();
            if (sleepData?.sleep?.summary?.duration) {
              sleep_hours = sleepData.sleep.summary.duration / 3600; // Convertir segundos a horas
            }
          }
          
          // Añadir datos del día
          weeklyData.push({
            date: dateStr,
            steps,
            calories,
            sleep_hours
          });
          
          // Guardar en la base de datos local para futuras consultas
          try {
            await sql`
              INSERT INTO daily_activities (user_fid, date, steps, calories, sleep_hours, created_at, updated_at)
              VALUES (${user_fid}, ${dateStr}, ${steps}, ${calories}, ${sleep_hours}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              ON CONFLICT (user_fid, date) 
              DO UPDATE SET
                steps = ${steps},
                calories = ${calories},
                sleep_hours = ${sleep_hours},
                updated_at = CURRENT_TIMESTAMP
            `;
          } catch (saveError) {
            console.error(`[Weekly Data] Error guardando datos del día ${dateStr} en la BD:`, saveError);
            // Continuamos a pesar del error
          }
          
        } catch (dayError) {
          console.error(`[Weekly Data] Error obteniendo datos para ${dateStr}:`, dayError);
          // Añadir día con datos vacíos en caso de error
          weeklyData.push({
            date: dateStr,
            steps: 0,
            calories: 0,
            sleep_hours: 0
          });
        }
        
        // Avanzar al siguiente día
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Guardar en caché
      weeklyDataCache.set(cacheKey, { data: weeklyData, timestamp: now });
      
      // Devolver los datos semanales
      return NextResponse.json({
        success: true,
        data: weeklyData,
        source: 'rook_api'
      });
      
    } catch (rookApiError) {
      console.error('[Weekly Data] Error obteniendo datos de Rook:', rookApiError);
      
      // Si estamos en desarrollo, generar datos de ejemplo
      if (process.env.NODE_ENV !== 'production') {
        const demoData = generateDemoData(start_date, end_date);
        
        // Guardar en caché y devolver
        weeklyDataCache.set(cacheKey, { data: demoData, timestamp: now });
        
        return NextResponse.json({
          success: true,
          data: demoData,
          source: 'demo_data'
        });
      }
      
      return NextResponse.json({ 
        success: false, 
        error: 'Error al obtener datos semanales de Rook' 
      }, { status: 502 });
    }
    
  } catch (error) {
    console.error('[Weekly Data] Error general:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}

// Función de utilidad para generar datos de ejemplo cuando estamos en desarrollo
function generateDemoData(startDate: string, endDate: string) {
  const demoData = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  let currentDate = new Date(start);
  
  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];
    
    // Datos aleatorios pero creíbles
    demoData.push({
      date: dateStr,
      steps: Math.floor(Math.random() * 5000) + 3000, // Entre 3000 y 8000 pasos
      calories: Math.floor(Math.random() * 200) + 150, // Entre 150 y 350 calorías
      sleep_hours: Math.round((Math.random() * 3 + 5) * 10) / 10 // Entre 5 y 8 horas (con un decimal)
    });
    
    // Avanzar al siguiente día
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return demoData;
} 