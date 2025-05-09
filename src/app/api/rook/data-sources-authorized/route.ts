import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Cache para datos de usuario y respuestas
const userCache = new Map<string, { rookUserId: string, timestamp: number }>();
const responseCache = new Map<string, { data: any, timestamp: number }>();

// Tiempo de vida de la caché en milisegundos (5 minutos)
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(request: Request) {
  try {
    // Extraer el user_fid del query parameter
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');
    // Parámetro para forzar actualización (omitir caché)
    const forceRefresh = searchParams.get('force_refresh') === 'true';

    if (!user_fid) {
      return NextResponse.json({ success: false, error: 'user_fid es requerido' }, { status: 400 });
    }

    console.log(`[API Rook Data Sources] Obteniendo fuentes conectadas para user_fid: ${user_fid}${forceRefresh ? ' (forzando actualización)' : ''}`);
    
    // Verificar si tenemos una respuesta en caché reciente (solo si no se fuerza actualización)
    const responseCacheKey = `sources_${user_fid}`;
    const cachedResponse = responseCache.get(responseCacheKey);
    const now = Date.now();
    
    if (!forceRefresh && cachedResponse && (now - cachedResponse.timestamp < CACHE_TTL)) {
      console.log(`[API Rook Data Sources] Usando respuesta en caché para user_fid: ${user_fid}`);
      return NextResponse.json({
        success: true,
        data: cachedResponse.data,
        cached: true
      });
    }

    // Obtener rookUserId (de caché si está disponible y no se fuerza actualización)
    let rookUserId: string;
    const cachedUser = userCache.get(user_fid);
    
    if (!forceRefresh && cachedUser && (now - cachedUser.timestamp < CACHE_TTL)) {
      rookUserId = cachedUser.rookUserId;
      console.log(`[API Rook Data Sources] Usando rookUserId desde caché: ${rookUserId}`);
    } else {
      try {
        // Buscamos el rook_user_id en la tabla rook_connection
        const connectionResult = await sql`
          SELECT id, rook_user_id, data_sources
          FROM rook_connection
          WHERE user_fid = ${user_fid}
          LIMIT 1
        `;

        if (connectionResult.length === 0 || !connectionResult[0].rook_user_id) {
          console.log(`[API Rook Data Sources] No se encontró conexión con Rook para user_fid: ${user_fid}`);
          
          // Intento fallback a user_connections por compatibilidad
          const legacyResult = await sql`
            SELECT id, rook_user_id
            FROM user_connections
            WHERE user_fid = ${user_fid}
            LIMIT 1
          `;
          
          if (legacyResult.length === 0 || !legacyResult[0].rook_user_id) {
            return NextResponse.json({ 
              success: false, 
              error: 'Usuario no conectado a Rook' 
            }, { status: 404 });
          }
          
          rookUserId = legacyResult[0].rook_user_id;
          console.log(`[API Rook Data Sources] Usando rook_user_id de tabla legacy: ${rookUserId}`);
        } else {
          rookUserId = connectionResult[0].rook_user_id;
          
          // Verificar si ya tenemos data_sources almacenado y actualizado
          if (!forceRefresh && connectionResult[0].data_sources) {
            console.log(`[API Rook Data Sources] Usando data_sources almacenado en BD`);
            
            // Guardamos en caché y devolvemos los datos almacenados
            const storedData = connectionResult[0].data_sources;
            responseCache.set(responseCacheKey, { data: storedData, timestamp: now });
            
            return NextResponse.json({
              success: true,
              data: storedData,
              source: 'database'
            });
          }
        }
        
        // Guardar en caché
        userCache.set(user_fid, { rookUserId, timestamp: now });
        console.log(`[API Rook Data Sources] Guardando rookUserId en caché: ${rookUserId}`);
        
      } catch (dbError) {
        console.error(`[API Rook Data Sources] Error consultando la base de datos:`, dbError);
        
        // Verificar si tenemos el user_fid directamente como rook_user_id
        rookUserId = user_fid;
        console.log(`[API Rook Data Sources] Usando user_fid como rookUserId alternativo: ${rookUserId}`);
      }
    }
    
    // Credenciales para la API de Rook
    const rookClientUuid = process.env.ROOK_CLIENT_UUID;
    const rookClientSecret = process.env.ROOK_CLIENT_SECRET;

    if (!rookClientUuid || !rookClientSecret) {
      console.error('[API Rook Data Sources] Falta configuración de Rook: client_uuid o client_secret no encontrados');
      return NextResponse.json(
        { success: false, error: 'Error en la configuración del servidor' },
        { status: 500 }
      );
    }

    // Función para intentar obtener los datos con reintentos
    const fetchDataWithRetries = async (retryCount = 0, maxRetries = 2) => {
      try {
        // Añadir un parámetro para evitar caché a nivel de la API de Rook
        const timestamp = new Date().getTime();
        const cacheParam = forceRefresh ? `?_nocache=${timestamp}` : '';

        // Llamamos a la API de Rook para obtener las fuentes de datos autorizadas
        console.log(`[API Rook Data Sources] Consultando API de Rook para user_id: ${rookUserId}${forceRefresh ? ' (sin caché)' : ''}`);
        const rookResponse = await fetch(
          `https://api.rook-connect.review/api/v1/user_id/${rookUserId}/data_sources/authorized${cacheParam}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${Buffer.from(`${rookClientUuid}:${rookClientSecret}`).toString('base64')}`,
              // Añadir headers para evitar caché si se solicita
              ...(forceRefresh ? {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              } : {})
            },
            // Añadir timeout para evitar bloqueos
            signal: AbortSignal.timeout(5000) // 5 segundos de timeout
          }
        );

        if (!rookResponse.ok) {
          const errorText = await rookResponse.text();
          console.error(`[API Rook Data Sources] Error consultando la API de Rook: ${rookResponse.status} - ${errorText}`);
          throw new Error(`Error consultando la API de Rook: ${rookResponse.status}`);
        }

        const rookData = await rookResponse.json();
        console.log(`[API Rook Data Sources] Fuentes autorizadas obtenidas para user_fid ${user_fid}:`, rookData);
        
        // Guardar en caché
        responseCache.set(responseCacheKey, { data: rookData, timestamp: now });
        
        // Guardar en la base de datos para futuras consultas
        try {
          await sql`
            UPDATE rook_connection
            SET 
              data_sources = ${JSON.stringify(rookData)}::jsonb,
              last_sync_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE user_fid = ${user_fid}
          `;
          console.log(`[API Rook Data Sources] Datos de fuentes guardados en BD para user_fid: ${user_fid}`);
        } catch (updateError) {
          console.error(`[API Rook Data Sources] Error actualizando data_sources en BD:`, updateError);
          // Continuamos a pesar del error para devolver los datos al cliente
        }
        
        return rookData;
      } catch (error) {
        console.error(`[API Rook Data Sources] Intento ${retryCount + 1}/${maxRetries + 1} falló:`, error);
        
        // Si hemos alcanzado el máximo de reintentos, lanzar el error
        if (retryCount >= maxRetries) {
          throw error;
        }
        
        // Esperar antes de reintentar (backoff exponencial)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        
        // Reintentar
        return fetchDataWithRetries(retryCount + 1, maxRetries);
      }
    };
    
    try {
      // Intentar obtener los datos con reintentos
      const rookData = await fetchDataWithRetries();
      
      // Devolvemos las fuentes de datos autorizadas
      return NextResponse.json({
        success: true,
        data: rookData,
        source: 'api'
      });
    } catch (apiError) {
      console.error(`[API Rook Data Sources] Error final al obtener datos:`, apiError);
      
      // Si la caché tiene datos antiguos, devolverlos como respaldo
      if (cachedResponse) {
        console.log(`[API Rook Data Sources] Usando respuesta en caché expirada como respaldo`);
        return NextResponse.json({
          success: true,
          data: cachedResponse.data,
          cached: true,
          stale: true
        });
      }
      
      return NextResponse.json({ 
        success: false, 
        error: 'Error al obtener las fuentes de datos. Por favor, inténtelo de nuevo más tarde.' 
      }, { status: 502 });
    }
    
  } catch (error) {
    console.error('[API Rook Data Sources] Error general:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor. Por favor, inténtelo de nuevo más tarde.' 
    }, { status: 500 });
  }
} 