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
        { 
          success: false, 
          error: 'user_fid y data_source son requeridos',
          details: { user_fid: !user_fid, data_source: !data_source }
        },
        { status: 400 }
      );
    }
    
    console.log(`[API Rook Revoke] Revocando acceso a ${data_source} para user_fid: ${user_fid}`);
    
    // Variable para almacenar el rook_user_id
    let rookUserId: string;
    let currentDataSources: any = null;
    
    // Obtener el rook_user_id del caché o la base de datos
    if (rookUserIdCache.has(user_fid)) {
      rookUserId = rookUserIdCache.get(user_fid)!;
      console.log(`[API Rook Revoke] Usando rook_user_id desde caché: ${rookUserId}`);
    } else {
      try {
        // Intentar obtener de rook_connection primero
        const connectionResult = await sql`
          SELECT rook_user_id, data_sources FROM rook_connection
          WHERE user_fid = ${user_fid} AND rook_user_id IS NOT NULL
          LIMIT 1
        `;
        
        if (connectionResult.length === 0) {
          // Fallback a user_connections para compatibilidad
          const legacyResult = await sql`
            SELECT rook_user_id FROM user_connections
            WHERE user_fid = ${user_fid} AND rook_user_id IS NOT NULL
            LIMIT 1
          `;
          
          if (legacyResult.length === 0) {
            return NextResponse.json(
              { 
                success: false, 
                error: 'Usuario no encontrado o no conectado a Rook',
                details: { user_fid }
              },
              { status: 404 }
            );
          }
          
          rookUserId = legacyResult[0].rook_user_id;
        } else {
          rookUserId = connectionResult[0].rook_user_id;
          currentDataSources = connectionResult[0].data_sources;
        }
        
        // Guardar en caché
        rookUserIdCache.set(user_fid, rookUserId);
        console.log(`[API Rook Revoke] Guardando rook_user_id en caché: ${rookUserId}`);
      } catch (dbError) {
        console.error(`[API Rook Revoke] Error al consultar la base de datos:`, dbError);
        return NextResponse.json(
          { 
            success: false, 
            error: 'Error al acceder a la base de datos',
            details: { message: dbError instanceof Error ? dbError.message : 'Unknown error' }
          },
          { status: 503 }
        );
      }
    }
    
    // Credenciales para la API de Rook
    const rookClientUuid = process.env.ROOK_CLIENT_UUID;
    const rookClientSecret = process.env.ROOK_CLIENT_SECRET;

    if (!rookClientUuid || !rookClientSecret) {
      console.error('[API Rook Revoke] Falta configuración de Rook: client_uuid o client_secret no encontrados');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Error en la configuración del servidor',
          details: { missing_credentials: { client_uuid: !rookClientUuid, client_secret: !rookClientSecret } }
        },
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
            signal: AbortSignal.timeout(5000) // 5 segundos de timeout
          }
        );

        if (!rookResponse.ok) {
          let errorMessage = 'Error revocando la conexión con Rook';
          let errorDetails: any = { status: rookResponse.status };
          
          try {
            const errorData = await rookResponse.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
            errorDetails.response = errorData;
          } catch {
            try {
              const errorText = await rookResponse.text();
              if (errorText) {
                errorMessage = errorText;
                errorDetails.response = errorText;
              }
            } catch {}
          }
          
          throw new Error(errorMessage);
        }

        const responseData = await rookResponse.json();
        return { success: true, data: responseData };
      } catch (error) {
        console.error(`[API Rook Revoke] Intento ${retryCount + 1}/${maxRetries + 1} falló:`, error);
        
        if (retryCount >= maxRetries) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        return attemptRevocation(retryCount + 1, maxRetries);
      }
    };
    
    try {
      // Intentar revocar con reintentos
      const revocationResult = await attemptRevocation();
      
      console.log(`[API Rook Revoke] Conexión revocada correctamente para user_fid: ${user_fid}, fuente: ${data_source}`);
      
      // Actualizar los datos en la base de datos para reflejar la revocación
      try {
        if (currentDataSources && currentDataSources.sources) {
          const updatedSources = { ...currentDataSources };
          
          if (updatedSources.sources && typeof updatedSources.sources === 'object') {
            updatedSources.sources[data_source] = false;
          }
          
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
        // Log pero no fallar, ya que la revocación fue exitosa
      }
      
      return NextResponse.json({
        success: true,
        message: `Conexión con ${data_source} revocada correctamente`,
        data: revocationResult.data
      });
    } catch (revokeError: any) {
      console.error(`[API Rook Revoke] Error final al revocar:`, revokeError);
      return NextResponse.json(
        { 
          success: false, 
          error: revokeError.message || 'Error al revocar la conexión',
          details: {
            message: revokeError instanceof Error ? revokeError.message : 'Unknown error',
            data_source,
            user_fid
          }
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[API Rook Revoke] Error general:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor. Por favor, inténtelo más tarde.',
        details: { message: error instanceof Error ? error.message : 'Unknown error' }
      },
      { status: 500 }
    );
  }
} 