import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

/**
 * Endpoint para manejar el callback después de que un usuario completa
 * el proceso de autorización con un proveedor en Rook.
 * Este endpoint puede manejar cualquier patrón de ruta, incluyendo
 * /api/rook/callback/client_uuid/{uuid}/user_id/{id}
 */
export async function GET(
  request: NextRequest,
  context: { params: { params?: string[] } }
) {
  try {
    // Obtener la URL completa para debugging
    const fullUrl = request.url;
    console.log(`[API Callback] URL completa: ${fullUrl}`);
    
    // Obtener los parámetros de la URL
    const { searchParams } = new URL(request.url);
    const queryUserId = searchParams.get('id');
    const status = searchParams.get('status');
    const dataSource = searchParams.get('data_source');
    const authorized = searchParams.get('authorized') === 'true';
    const rookUserIdParam = searchParams.get('rook_user_id');
    const rookToken = searchParams.get('rook_token');
    const fromFarcaster = searchParams.get('from_farcaster') === 'true';

    // Buscar user_id y client_uuid en los parámetros de ruta si están disponibles
    let pathUserId = null;
    let clientUuid = null;
    
    // Extraer información de los segmentos de ruta
    const routeParams = context.params?.params || [];
    const paramsStr = routeParams.join('/');
    
    if (paramsStr) {
      // Buscar user_id en el path
      const userIdMatch = paramsStr.match(/user_id\/([^\/]+)/);
      if (userIdMatch) {
        pathUserId = userIdMatch[1];
      }
      
      // Buscar client_uuid en el path
      const clientUuidMatch = paramsStr.match(/client_uuid\/([^\/]+)/);
      if (clientUuidMatch) {
        clientUuid = clientUuidMatch[1];
      }
      
      console.log(`[API Callback] Parámetros de ruta: user_id=${pathUserId}, client_uuid=${clientUuid}`);
    }

    console.log(`[API Callback] Parámetros recibidos: 
      query_id=${queryUserId}, 
      path_id=${pathUserId},
      status=${status},
      data_source=${dataSource},
      authorized=${authorized},
      rook_user_id=${rookUserIdParam},
      rook_token=${rookToken ? '[RECIBIDO]' : '[NO RECIBIDO]'},
      from_farcaster=${fromFarcaster}`);

    // Priorizar ID en el siguiente orden: query parameter, path parameter
    let resolvedUserId = queryUserId || pathUserId;
    
    // Si aún no tenemos ID, buscar en la URL completa
    if (!resolvedUserId) {
      console.log('[API Callback] Buscando id en otras partes de la URL...');
      
      // Intentar extraer de posibles patrones en la URL
      const idMatch = fullUrl.match(/[?&]id=([^&#]+)/);
      if (idMatch && idMatch[1]) {
        resolvedUserId = idMatch[1];
        console.log(`[API Callback] Encontrado id=${resolvedUserId} en la URL`);
      }
      
      // También intentar buscar por user_id en la URL completa
      const userIdMatch = fullUrl.match(/user_id\/([^\/&#]+)/);
      if (!resolvedUserId && userIdMatch) {
        resolvedUserId = userIdMatch[1];
        console.log(`[API Callback] Encontrado id=${resolvedUserId} en la URL`);
      }
    }

    // Validar parámetros requeridos
    if (!resolvedUserId) {
      console.error('[API Callback] Falta ID en el callback');
      return NextResponse.redirect(new URL('/error?message=missing_id', request.url));
    }

    // Si el status es 'error', redirigir a una página de error
    if (status === 'error' || status === 'failed') {
      console.error('[API Callback] Error en la conexión con Rook');
      return NextResponse.redirect(new URL('/error?message=connection_failed', request.url));
    }

    // Buscar información sobre el usuario en la base de datos
    const userInfo = await sql`
      SELECT user_fid FROM whitelist_users
      WHERE id = ${resolvedUserId}
      LIMIT 1
    `;
    
    if (userInfo.length === 0) {
      console.error(`[API Callback] No se encontró información para el ID: ${resolvedUserId}`);
      return NextResponse.redirect(new URL('/error?message=user_not_found', request.url));
    }
    
    const userFid = userInfo[0].user_fid;
    console.log(`[API Callback] Asociado ID ${resolvedUserId} con user_fid ${userFid}`);

    // Siempre intentamos guardar la conexión, incluso si 'authorized' no está explícitamente definido
    try {
      // Actualizar la conexión en la base de datos
      console.log(`[API Callback] Actualizando conexión para user_fid=${userFid}`);
      
      // Verificar si ya existe una conexión
      const existingConnection = await sql`
        SELECT id FROM user_connections
        WHERE user_fid = ${userFid}
        LIMIT 1
      `;

      // Usar rookUserIdParam si está disponible, de lo contrario usar resolvedUserId
      let finalRookUserId = rookUserIdParam || resolvedUserId;
      let finalRookToken = rookToken;
      let rookRefreshToken = null;
      let rookTokenExpiry = null;

      // Siempre intentar obtener información completa de Rook
      try {
        console.log(`[API Callback] Obteniendo información de Rook para user_id=${finalRookUserId}`);
        
        const rookClientUuid = process.env.ROOK_CLIENT_UUID;
        const rookClientSecret = process.env.ROOK_CLIENT_SECRET;
        
        if (rookClientUuid && rookClientSecret) {
          // Preparar credenciales para Basic Authentication
          const credentials = Buffer.from(`${rookClientUuid}:${rookClientSecret}`).toString('base64');
          
          // Llamar a la API de Rook para obtener/validar el usuario y sus tokens
          const rookResponse = await fetch(`https://api.rook-connect.review/v2/users/${finalRookUserId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${credentials}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log(`[API Callback] Respuesta de Rook status: ${rookResponse.status}`);
          
          if (rookResponse.ok) {
            const userData = await rookResponse.json();
            console.log(`[API Callback] Datos de usuario obtenidos de Rook:`, JSON.stringify(userData, null, 2));
            
            // Actualizar valores si están disponibles en la respuesta
            if (userData.user_id) {
              finalRookUserId = userData.user_id;
            }
            
            // Si hay tokens disponibles en la respuesta, guardarlos
            if (userData.token) {
              finalRookToken = userData.token;
            }
            
            if (userData.refresh_token) {
              rookRefreshToken = userData.refresh_token;
            }
            
            // Establecer fecha de expiración (1 día por defecto)
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 1);
            rookTokenExpiry = expiryDate.toISOString();
          } else {
            console.error(`[API Callback] Error obteniendo datos del usuario de Rook:`, await rookResponse.text());
          }
        }
      } catch (tokenError) {
        console.error(`[API Callback] Error obteniendo token de Rook:`, tokenError);
      }

      // Guardar la conexión, incluso si no pudimos obtener todos los tokens
      console.log(`[API Callback] Guardando conexión con datos: 
        user_fid=${userFid}, 
        rook_user_id=${finalRookUserId},
        rook_token_present=${!!finalRookToken},
        refresh_token_present=${!!rookRefreshToken}`);

      if (existingConnection.length > 0) {
        // Actualizar la conexión existente con todos los datos disponibles
        await sql`
          UPDATE user_connections
          SET 
            provider = 'rook',
            rook_user_id = ${finalRookUserId},
            rook_token = ${finalRookToken || null},
            rook_refresh_token = ${rookRefreshToken || null},
            rook_token_expiry = ${rookTokenExpiry || null},
            updated_at = CURRENT_TIMESTAMP
          WHERE user_fid = ${userFid}
        `;
      } else {
        // Crear una nueva conexión con todos los datos disponibles
        await sql`
          INSERT INTO user_connections
            (user_fid, provider, rook_user_id, rook_token, rook_refresh_token, rook_token_expiry, created_at, updated_at)
          VALUES
            (${userFid}, 'rook', ${finalRookUserId}, ${finalRookToken || null}, ${rookRefreshToken || null}, ${rookTokenExpiry || null}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
      }

      // También actualizamos la tabla whitelist_users para marcar el proveedor
      await sql`
        UPDATE whitelist_users
        SET connected_provider = 'rook'
        WHERE user_fid = ${userFid}
      `;

      console.log(`[API Callback] Conexión guardada exitosamente`);
    } catch (dbError) {
      console.error('[API Callback] Error guardando la conexión:', dbError);
      return NextResponse.redirect(new URL('/error?message=database_error', request.url));
    }

    // Redirigir según de dónde vino la solicitud
    if (fromFarcaster) {
      // Redirigir a la versión de Farcaster
      console.log('[API Callback] Redirigiendo a Farcaster');
      return NextResponse.redirect(new URL('/frame?connection=success', request.url));
    } else {
      // Redirigir al dashboard normal
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      console.log(`[API Callback] Redirigiendo al dashboard: ${baseUrl}/dashboard?connection=success`);
      return NextResponse.redirect(new URL(`${baseUrl}/dashboard?connection=success`, request.url));
    }
  } catch (error) {
    console.error('[API Callback] Error general:', error);
    return NextResponse.redirect(new URL('/error?message=server_error', request.url));
  }
} 