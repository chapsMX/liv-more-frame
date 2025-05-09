import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

/**
 * Esta es una ruta catch-all para manejar cualquier patrón de URL bajo /api/rook/callback-catchall
 * Especialmente para manejar URLs como /api/rook/callback-catchall/client_uuid/xxx/user_id/y
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { params: string[] } }
) {
  console.log(`[Callback Catch-all] GET request received with params:`, params.params);
  
  // Buscar user_id y client_uuid en los parámetros
  let userId = null;
  let clientUuid = null;
  
  // Intentar extraer los parámetros desde la URL o los parámetros de ruta
  const paramsStr = params.params.join('/');
  const userIdMatch = paramsStr.match(/user_id\/([^\/]+)/);
  const clientUuidMatch = paramsStr.match(/client_uuid\/([^\/]+)/);
  
  if (userIdMatch) userId = userIdMatch[1];
  if (clientUuidMatch) clientUuid = clientUuidMatch[1];
  
  console.log(`[Callback Catch-all] Extracted params: user_id=${userId}, client_uuid=${clientUuid}`);
  
  // Obtener otros parámetros de la URL
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const dataSource = searchParams.get('data_source');
  const authorized = searchParams.get('authorized') === 'true';
  const rookUserIdParam = searchParams.get('rook_user_id') || userId;
  const rookToken = searchParams.get('rook_token');
  const fromFarcaster = searchParams.get('from_farcaster') === 'true';

  console.log(`[Callback Catch-all] URL params: 
    status=${status},
    data_source=${dataSource},
    authorized=${authorized},
    rook_user_id=${rookUserIdParam},
    rook_token=${rookToken ? '[RECIBIDO]' : '[NO RECIBIDO]'},
    from_farcaster=${fromFarcaster}`);
  
  // Verificar si tenemos un user_id válido
  if (!userId || isNaN(Number(userId))) {
    console.error('[Callback Catch-all] ID de usuario inválido o no encontrado');
    return NextResponse.redirect(new URL('/error?message=invalid_id', request.url));
  }
  
  // Si el status es 'error', redirigir a una página de error
  if (status === 'error' || status === 'failed') {
    console.error('[Callback Catch-all] Error en la conexión con Rook');
    return NextResponse.redirect(new URL('/error?message=connection_failed', request.url));
  }

  try {
    // Buscar información sobre el usuario en la base de datos
    const userInfo = await sql`
      SELECT user_fid FROM whitelist_users
      WHERE id = ${userId}
      LIMIT 1
    `;
    
    if (userInfo.length === 0) {
      console.error(`[Callback Catch-all] No se encontró información para el ID: ${userId}`);
      return NextResponse.redirect(new URL('/error?message=user_not_found', request.url));
    }
    
    const userFid = userInfo[0].user_fid;
    console.log(`[Callback Catch-all] Asociado ID ${userId} con user_fid ${userFid}`);
    
    // Guardar la conexión en la base de datos
    try {
      // Actualizar la conexión en la base de datos
      console.log(`[Callback Catch-all] Actualizando conexión para user_fid=${userFid}`);
      
      // Verificar si ya existe una conexión
      const existingConnection = await sql`
        SELECT id FROM user_connections
        WHERE user_fid = ${userFid}
        LIMIT 1
      `;

      if (existingConnection.length > 0) {
        // Actualizar la conexión existente
        await sql`
          UPDATE user_connections
          SET 
            provider = ${dataSource || 'rook'},
            rook_user_id = ${rookUserIdParam},
            rook_token = ${rookToken},
            updated_at = CURRENT_TIMESTAMP
          WHERE user_fid = ${userFid}
        `;
      } else {
        // Crear una nueva conexión
        await sql`
          INSERT INTO user_connections
            (user_fid, provider, rook_user_id, rook_token, created_at, updated_at)
          VALUES
            (${userFid}, ${dataSource || 'rook'}, ${rookUserIdParam}, ${rookToken}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
      }

      // También actualizamos la tabla whitelist_users para marcar el proveedor
      await sql`
        UPDATE whitelist_users
        SET connected_provider = ${dataSource || 'rook'}
        WHERE user_fid = ${userFid}
      `;

      console.log(`[Callback Catch-all] Conexión guardada exitosamente`);
    } catch (dbError) {
      console.error('[Callback Catch-all] Error guardando la conexión:', dbError);
      return NextResponse.redirect(new URL('/error?message=database_error', request.url));
    }
    
    // Redirigir según de dónde vino la solicitud
    if (fromFarcaster) {
      // Redirigir a la versión de Farcaster
      console.log('[Callback Catch-all] Redirigiendo a Farcaster');
      return NextResponse.redirect(new URL('/frame?connection=success', request.url));
    } else {
      // Redirigir al dashboard normal
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      return NextResponse.redirect(new URL(`${baseUrl}/dashboard?connection=success`, request.url));
    }
  } catch (error) {
    console.error('[Callback Catch-all] Error general:', error);
    return NextResponse.redirect(new URL('/error?message=server_error', request.url));
  }
} 