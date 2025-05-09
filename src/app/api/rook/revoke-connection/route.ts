import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Cache para almacenar temporalmente los rookUserIds por userFid
const rookUserIdCache = new Map<string, string>();

export async function POST(request: Request) {
  try {
    // Obtener user_fid y data_source del cuerpo de la solicitud
    const { user_fid, data_source } = await request.json();
    
    if (!user_fid || !data_source) {
      return NextResponse.json(
        { success: false, error: 'user_fid y data_source son requeridos' },
        { status: 400 }
      );
    }
    
    console.log(`[API Rook Revoke] Revocando acceso a ${data_source} para user_fid: ${user_fid}`);
    
    // Variable para almacenar el rook_user_id
    let rookUserId: string;
    let currentDataSources: any = null;
    
    // Verificar si tenemos el rookUserId en caché
    if (rookUserIdCache.has(user_fid.toString())) {
      rookUserId = rookUserIdCache.get(user_fid.toString())!;
      console.log(`[API Rook Revoke] Usando rook_user_id desde caché: ${rookUserId}`);
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
          console.log(`[API Rook Revoke] No se encontró conexión con Rook para user_fid: ${user_fid}`);
          
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
          console.log(`[API Rook Revoke] Usando rook_user_id de tabla legacy: ${rookUserId}`);
        } else {
          rookUserId = connectionResult[0].rook_user_id;
          
          // Guardar la información actual de data_sources para actualizarla después
          if (connectionResult[0].data_sources) {
            currentDataSources = connectionResult[0].data_sources;
            console.log('[API Rook Revoke] Datos actuales de fuentes recuperados de BD');
          }
        }
        
        // Guardar en caché para futuros usos
        rookUserIdCache.set(user_fid.toString(), rookUserId);
        console.log(`[API Rook Revoke] Guardando rook_user_id en caché: ${rookUserId}`);
        
      } catch (dbError) {
        console.error(`[API Rook Revoke] Error al consultar la base de datos:`, dbError);
        
        // Usar user_fid como rookUserId si no se encontró en la base de datos
        rookUserId = user_fid;
        console.log(`[API Rook Revoke] Usando user_fid como rook_user_id alternativo: ${rookUserId}`);
      }
    }
    
    // Credenciales para la API de Rook
    const rookClientUuid = process.env.ROOK_CLIENT_UUID;
    const rookClientSecret = process.env.ROOK_CLIENT_SECRET;

    if (!rookClientUuid || !rookClientSecret) {
      console.error('[API Rook Revoke] Falta configuración de Rook: client_uuid o client_secret no encontrados');
      return NextResponse.json(
        { success: false, error: 'Error en la configuración del servidor' },
        { status: 500 }
      );
    }
    
    // Definir la función para intentar la revocación
    const attemptRevocation = async (retryCount = 0, maxRetries = 2) => {
      try {
        // Llamamos a la API de Rook para revocar la conexión
        const rookResponse = await fetch(
          `https://api.rook-connect.review/api/v1/user_id/${rookUserId}/data_sources/revoke_auth`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${Buffer.from(`${rookClientUuid}:${rookClientSecret}`).toString('base64')}`,
            },
            body: JSON.stringify({
              data_source: data_source
            }),
            // Añadir timeout para evitar bloqueos largos
            signal: AbortSignal.timeout(5000) // 5 segundos de timeout
          }
        );

        if (!rookResponse.ok) {
          let errorMessage = 'Error revocando la conexión con Rook';
          try {
            const errorData = await rookResponse.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            // Intentar obtener mensaje de error como texto
            try {
              const errorText = await rookResponse.text();
              if (errorText) errorMessage = errorText;
            } catch {}
          }
          
          throw new Error(errorMessage);
        }

        return { success: true };
      } catch (error) {
        console.error(`[API Rook Revoke] Intento ${retryCount + 1}/${maxRetries + 1} falló:`, error);
        
        // Si hemos alcanzado el máximo de reintentos, lanzar el error
        if (retryCount >= maxRetries) {
          throw error;
        }
        
        // Esperar antes de reintentar (backoff exponencial)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        
        // Reintentar
        return attemptRevocation(retryCount + 1, maxRetries);
      }
    };
    
    try {
      // Intentar revocar con reintentos
      await attemptRevocation();
      
      console.log(`[API Rook Revoke] Conexión revocada correctamente para user_fid: ${user_fid}, fuente: ${data_source}`);
      
      // Actualizar los datos en la base de datos para reflejar la revocación
      try {
        // Si tenemos data_sources actual, actualizamos solo la fuente específica
        if (currentDataSources && currentDataSources.sources) {
          // Crear una copia de los datos actuales
          const updatedSources = { ...currentDataSources };
          
          // Modificar la fuente específica como no autorizada
          if (updatedSources.sources && typeof updatedSources.sources === 'object') {
            updatedSources.sources[data_source] = false;
          }
          
          // Actualizar en la base de datos
          await sql`
            UPDATE rook_connection
            SET 
              data_sources = ${JSON.stringify(updatedSources)}::jsonb,
              last_sync_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE user_fid = ${user_fid}
          `;
          console.log(`[API Rook Revoke] Datos de fuentes actualizados en BD para user_fid: ${user_fid}`);
        } else {
          // Si no tenemos datos actuales, marcamos el estado para esta fuente
          const defaultSources = {
            user_id: rookUserId,
            sources: {
              [data_source]: false
            }
          };
          
          await sql`
            UPDATE rook_connection
            SET 
              data_sources = ${JSON.stringify(defaultSources)}::jsonb,
              connection_status = CASE 
                WHEN connection_status = 'active' THEN 'partial' 
                ELSE connection_status 
              END,
              last_sync_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE user_fid = ${user_fid}
          `;
          console.log(`[API Rook Revoke] Estado de conexión actualizado en BD para user_fid: ${user_fid}`);
        }
      } catch (dbError) {
        console.error(`[API Rook Revoke] Error actualizando estado en BD:`, dbError);
        // Continuamos a pesar del error para devolver éxito al cliente
      }
      
      // Actualizar el estado en el front-end
      return NextResponse.json({
        success: true,
        message: `Conexión con ${data_source} revocada correctamente`
      });
    } catch (revokeError: any) {
      console.error(`[API Rook Revoke] Error final al revocar:`, revokeError);
      return NextResponse.json(
        { success: false, error: revokeError.message || 'Error al revocar la conexión' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('[API Rook Revoke] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor. Por favor, inténtelo más tarde.' },
      { status: 500 }
    );
  }
} 