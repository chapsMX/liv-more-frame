import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Mapa para almacenar la última vez que se solicitaron datos por user_fid y fecha
const requestCache = new Map<string, { timestamp: number, data: any }>();

// Caché para datos de Rook API - Para evitar múltiples llamadas en un corto período
const rookApiCache = new Map<string, { timestamp: number, data: any, status: number }>();
const ROOK_CACHE_TTL = 30 * 1000; // 30 segundos para API calls

export async function GET(request: Request) {
  try {
    // Obtener parámetros
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const force_refresh = searchParams.get('force_refresh') === 'true';

    if (!user_fid) {
      return NextResponse.json({ 
        success: false, 
        error: 'user_fid es requerido' 
      }, { status: 400 });
    }

    // Crear clave para el caché
    const cacheKey = `${user_fid}-${date}`;
    const now = Date.now();
    
    // Verificar caché (10 segundos de validez) - a menos que se solicite refresh forzado
    if (!force_refresh) {
      const cachedResponse = requestCache.get(cacheKey);
      if (cachedResponse && (now - cachedResponse.timestamp < 10000)) {
        console.log(`[Dashboard] Usando datos en caché para user_fid: ${user_fid}, fecha: ${date}`);
        return NextResponse.json({
          ...cachedResponse.data,
          cached: true
        });
      }
    }

    // Primero intentamos obtener los datos de nuestra base de datos local
    console.log(`[Dashboard] Buscando datos locales para user_fid: ${user_fid}, fecha: ${date}`);
    
    const localData = await sql`
      SELECT * FROM daily_activities 
      WHERE user_fid = ${user_fid} AND date = ${date}
      LIMIT 1
    `;
    
    if (localData.length > 0) {
      console.log(`[Dashboard] Encontrados datos locales para user_fid: ${user_fid}, fecha: ${date}`);
      
      // Obtener información del usuario
      const userInfo = await sql`
        SELECT username, display_name FROM whitelist_users
        WHERE user_fid = ${user_fid}
        LIMIT 1
      `;
      
      // Formar respuesta con datos locales
      const dashboardData = {
        user: userInfo.length > 0 ? {
          username: userInfo[0].username,
          display_name: userInfo[0].display_name || userInfo[0].username
        } : null,
        date: date,
        physical: {
          steps: localData[0].steps || 0,
          calories: localData[0].calories || 0
        },
        sleep: {
          hours: localData[0].sleep_hours || 0,
          efficiency: 0 // No tenemos este dato localmente
        }
      };
      
      const response = {
        success: true,
        data: dashboardData,
        source: 'local_db'
      };
      
      // Guardar en caché
      requestCache.set(cacheKey, { timestamp: now, data: response });
      
      return NextResponse.json(response);
    }
    
    // Si no hay datos locales, intentamos obtenerlos de Rook
    console.log(`[Dashboard] No se encontraron datos locales, consultando a Rook`);

    // Obtener conexión Rook del usuario
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
        console.log(`[Dashboard] Usando rook_user_id de rook_connection: ${rookUserId}`);
      } else {
        // Fallback a user_connections para compatibilidad
        const legacyResult = await sql`
          SELECT rook_user_id FROM user_connections
          WHERE user_fid = ${user_fid} AND rook_user_id IS NOT NULL
          LIMIT 1
        `;
        
        if (legacyResult.length === 0 || !legacyResult[0].rook_user_id) {
          console.log(`[Dashboard] No se encontró conexión con Rook para user_fid: ${user_fid}`);
          return NextResponse.json({ 
            success: false, 
            error: 'Usuario no conectado a Rook' 
          }, { status: 404 });
        }
        
        rookUserId = legacyResult[0].rook_user_id;
        console.log(`[Dashboard] Usando rook_user_id de tabla legacy: ${rookUserId}`);
      }
    } catch (dbError) {
      console.error(`[Dashboard] Error consultando conexión con Rook:`, dbError);
      
      // Usar user_fid como alternativa
      rookUserId = user_fid;
      console.log(`[Dashboard] Usando user_fid como rook_user_id alternativo: ${rookUserId}`);
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

    // Preparar credenciales para Basic Authentication
    const credentials = Buffer.from(`${rookClientUuid}:${rookClientSecret}`).toString('base64');
    
    // Función para obtener datos de una API de Rook con caché
    const fetchRookEndpoint = async (url: string, cacheKey: string, force = false) => {
      const endpointCacheKey = `${cacheKey}-${url}`;
      const cachedResponse = rookApiCache.get(endpointCacheKey);
      
      // Usar caché si está disponible y no se fuerza actualización
      if (!force && cachedResponse && (now - cachedResponse.timestamp < ROOK_CACHE_TTL)) {
        console.log(`[Dashboard] Usando respuesta cacheada para: ${url}`);
        return {
          status: cachedResponse.status,
          data: cachedResponse.data,
          cached: true
        };
      }
      
      // Si no está en caché o se fuerza actualización, hacer petición
      console.log(`[Dashboard] Consultando datos físicos: ${url}`);
      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        signal: AbortSignal.timeout(5000) // 5 segundos timeout
      });
      
      let responseData = null;
      
      if (response.status === 200) {
        responseData = await response.json();
      }
      
      // Guardar en caché
      rookApiCache.set(endpointCacheKey, {
        timestamp: now,
        status: response.status,
        data: responseData
      });
      
      return {
        status: response.status,
        data: responseData,
        cached: false
      };
    };
    
    // Obtener datos de actividad física 
    const physicalUrl = `https://api.rook-connect.review/v2/processed_data/physical_health/summary?user_id=${rookUserId}&date=${date}`;
    const physicalResponse = await fetchRookEndpoint(physicalUrl, `physical-${rookUserId}`, force_refresh);
    
    // Obtener datos de sueño
    const sleepUrl = `https://api.rook-connect.review/v2/processed_data/sleep/summary?user_id=${rookUserId}&date=${date}`;
    const sleepResponse = await fetchRookEndpoint(sleepUrl, `sleep-${rookUserId}`, force_refresh);

    // También intentamos la estructura alternativa de Sleep Health que usa Fitbit
    const sleepHealthUrl = `https://api.rook-connect.review/v2/processed_data/sleep_health/summary?user_id=${rookUserId}&date=${date}`;
    const sleepHealthResponse = await fetchRookEndpoint(sleepHealthUrl, `sleep-health-${rookUserId}`, force_refresh);

    // Procesar respuestas
    let physicalData = null;
    let sleepData = null;
    let hasAnyData = false;
    let sleepDuration = 0;
    let sleepEfficiency = 0;

    console.log(`[Dashboard] Respuesta física status: ${physicalResponse.status}`);
    console.log(`[Dashboard] Respuesta sueño status: ${sleepResponse.status}`);
    console.log(`[Dashboard] Respuesta sleep_health status: ${sleepHealthResponse.status}`);

    if (physicalResponse.status === 200) {
      physicalData = physicalResponse.data;
      console.log(`[Dashboard] Datos físicos: ${JSON.stringify(physicalData, null, 2)}`);
      hasAnyData = true;
    } else if (physicalResponse.status === 204) {
      console.log(`[Dashboard] No hay datos físicos disponibles (respuesta vacía)`);
      // Para código 204, creamos un objeto vacío para representar los datos sin contenido
      physicalData = {
        physical_health: {
          summary: {
            steps: 0,
            active_calories: 0
          }
        }
      };
    }

    // Intentar obtener datos de sueño de la estructura estándar
    if (sleepResponse.status === 200) {
      sleepData = sleepResponse.data;
      console.log(`[Dashboard] Datos sueño: ${JSON.stringify(sleepData, null, 2)}`);
      hasAnyData = true;
      
      if (sleepData?.sleep?.summary?.duration) {
        sleepDuration = sleepData.sleep.summary.duration / 3600; // Convertir segundos a horas
        sleepEfficiency = sleepData?.sleep?.summary?.efficiency || 0;
      }
    }
    
    // Intentar obtener datos de sueño de la estructura sleep_health (usada por Fitbit)
    if (sleepHealthResponse.status === 200) {
      const sleepHealthData = sleepHealthResponse.data;
      console.log(`[Dashboard] Datos sleep_health: ${JSON.stringify(sleepHealthData, null, 2)}`);
      hasAnyData = true;
      
      // Si no se encontraron datos en la estructura estándar, buscamos en sleep_health
      if (sleepDuration === 0 && sleepHealthData?.sleep_health?.summary?.sleep_summary?.duration?.sleep_duration_seconds_int) {
        sleepDuration = sleepHealthData.sleep_health.summary.sleep_summary.duration.sleep_duration_seconds_int / 3600;
        sleepEfficiency = sleepHealthData.sleep_health.summary.sleep_summary.scores?.sleep_efficiency_1_100_score_int || 0;
        console.log(`[Dashboard] Extrayendo duración de sueño: ${sleepDuration} horas, eficiencia: ${sleepEfficiency}`);
      }
      
      // Si aún no encontramos datos, buscamos en non_structured_data_array para Fitbit
      if (sleepDuration === 0 && 
          sleepHealthData?.sleep_health?.summary?.sleep_summary?.non_structured_data_array && 
          sleepHealthData.sleep_health.summary.sleep_summary.non_structured_data_array.length > 0) {
        
        // Recorremos el array buscando datos de sueño de Fitbit
        for (const item of sleepHealthData.sleep_health.summary.sleep_summary.non_structured_data_array) {
          // Formato Fitbit: minutesAsleep o duration
          if (item && typeof item === 'object') {
            if (item.minutesAsleep !== undefined) {
              sleepDuration = item.minutesAsleep / 60; // Convertir minutos a horas
              sleepEfficiency = item.efficiency || 0;
              console.log(`[Dashboard] Encontrados datos de sueño Fitbit: ${sleepDuration} horas, eficiencia: ${sleepEfficiency}`);
              break;
            } else if (item.duration !== undefined) {
              sleepDuration = item.duration / 3600000; // Convertir milisegundos a horas
              sleepEfficiency = item.efficiency || 0;
              console.log(`[Dashboard] Encontrados datos de duración de sueño Fitbit: ${sleepDuration} horas, eficiencia: ${sleepEfficiency}`);
              break;
            }
          }
        }
      }
    }

    // Si no tenemos datos ni físicos ni de sueño, devolvemos éxito falso
    if (!hasAnyData && physicalResponse.status !== 204 && sleepResponse.status !== 204 && sleepHealthResponse.status !== 204) {
      const response = { 
        success: false, 
        error: 'No hay datos disponibles para la fecha seleccionada' 
      };
      
      // Guardar en caché para evitar peticiones repetidas
      requestCache.set(cacheKey, { timestamp: now, data: response });
      
      return NextResponse.json(response, { status: 200 });
    }

    // Obtener información del usuario
    const userInfo = await sql`
      SELECT username, display_name FROM whitelist_users
      WHERE user_fid = ${user_fid}
      LIMIT 1
    `;

    // Formar respuesta consolidada
    const dashboardData = {
      user: userInfo.length > 0 ? {
        username: userInfo[0].username,
        display_name: userInfo[0].display_name || userInfo[0].username
      } : null,
      date: date,
      physical: {
        steps: physicalData?.physical_health?.summary?.steps || 0,
        calories: physicalData?.physical_health?.summary?.active_calories || 0
      },
      sleep: {
        hours: sleepDuration,
        efficiency: sleepEfficiency
      }
    };

    const response = {
      success: true,
      data: dashboardData,
      source: 'rook_api',
      api_cached: physicalResponse.cached || sleepResponse.cached || sleepHealthResponse.cached
    };
    
    // Guardar en caché
    requestCache.set(cacheKey, { timestamp: now, data: response });

    // También guardar en la base de datos para consultas futuras si tenemos datos válidos
    if (sleepDuration > 0 || dashboardData.physical.steps > 0 || dashboardData.physical.calories > 0) {
      try {
        // Verificar si ya existe un registro para esa fecha
        const existingRecord = await sql`
          SELECT id FROM daily_activities
          WHERE user_fid = ${user_fid} AND date = ${date}
          LIMIT 1
        `;
        
        if (existingRecord.length > 0) {
          // Actualizar registro existente
          await sql`
            UPDATE daily_activities
            SET 
              sleep_hours = ${sleepDuration || 0},
              steps = ${dashboardData.physical.steps || 0},
              calories = ${dashboardData.physical.calories || 0},
              updated_at = CURRENT_TIMESTAMP
            WHERE user_fid = ${user_fid} AND date = ${date}
          `;
          console.log(`[Dashboard] Actualizados datos locales para user_fid ${user_fid}, fecha ${date}`);
        } else {
          // Crear nuevo registro
          await sql`
            INSERT INTO daily_activities
              (user_fid, date, sleep_hours, steps, calories, created_at, updated_at)
            VALUES
              (${user_fid}, ${date}, ${sleepDuration || 0}, ${dashboardData.physical.steps || 0}, ${dashboardData.physical.calories || 0}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `;
          console.log(`[Dashboard] Creado nuevo registro local para user_fid ${user_fid}, fecha ${date}`);
        }
      } catch (dbError) {
        console.error('[Dashboard] Error guardando datos en BD local:', dbError);
        // Continuamos a pesar del error para devolver los datos al cliente
      }
    }

    console.log(`[Dashboard] Respuesta final: ${JSON.stringify(response, null, 2)}`);
    return NextResponse.json(response);
  } catch (error) {
    console.error('[Dashboard] Error obteniendo datos:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
} 