import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

/**
 * Esta es una ruta catch-all para manejar cualquier patrón de URL bajo /api/rook/webhook-catchall
 * Especialmente para manejar URLs como /api/rook/webhook-catchall/client_uuid/xxx/user_id/y
 * que Rook parece estar enviando erróneamente.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { params: string[] } }
) {
  console.log(`[Webhook Catch-all] GET request received with params:`, params.params);
  
  // Buscar user_id y client_uuid en los parámetros
  let userId = null;
  let clientUuid = null;
  
  // Intentar extraer los parámetros desde la URL o los parámetros de ruta
  const paramsStr = params.params.join('/');
  const userIdMatch = paramsStr.match(/user_id\/([^\/]+)/);
  const clientUuidMatch = paramsStr.match(/client_uuid\/([^\/]+)/);
  
  if (userIdMatch) userId = userIdMatch[1];
  if (clientUuidMatch) clientUuid = clientUuidMatch[1];
  
  console.log(`[Webhook Catch-all] Extracted params: user_id=${userId}, client_uuid=${clientUuid}`);
  
  // Verificar si tenemos los parámetros necesarios para guardar una conexión
  if (userId && clientUuid && !isNaN(Number(userId))) {
    // Parece que este es un intento de autorización que fue redirigido al webhook
    console.log(`[Webhook Catch-all] Detectada posible autorización: user_id=${userId}, client_uuid=${clientUuid}`);
    
    try {
      // Intentar guardar la conexión en la base de datos
      const userInfo = await sql`
        SELECT user_fid FROM whitelist_users
        WHERE id = ${userId}
        LIMIT 1
      `;
      
      if (userInfo.length > 0) {
        const userFid = userInfo[0].user_fid;
        console.log(`[Webhook Catch-all] Encontrado user_fid=${userFid} para id=${userId}`);
        
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
              provider = 'rook',
              rook_user_id = ${userId},
              updated_at = CURRENT_TIMESTAMP
            WHERE user_fid = ${userFid}
          `;
        } else {
          // Crear una nueva conexión
          await sql`
            INSERT INTO user_connections
              (user_fid, provider, rook_user_id, created_at, updated_at)
            VALUES
              (${userFid}, 'rook', ${userId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `;
        }
        
        // También actualizamos la tabla whitelist_users
        await sql`
          UPDATE whitelist_users
          SET connected_provider = 'rook'
          WHERE user_fid = ${userFid}
        `;
        
        console.log(`[Webhook Catch-all] Conexión guardada para user_fid=${userFid}`);
        
        // Redirigir al dashboard con un mensaje de éxito
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        return NextResponse.redirect(new URL(`${baseUrl}/dashboard?connection=success`, request.url));
      }
    } catch (error) {
      console.error('[Webhook Catch-all] Error guardando conexión:', error);
    }
  }
  
  // Respuesta normal si no es una autorización
  return NextResponse.json({ 
    success: true, 
    message: 'Webhook catchall endpoint working',
    params: {
      path_segments: params.params,
      user_id: userId || 'not found',
      client_uuid: clientUuid || 'not found'
    }
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { params: string[] } }
) {
  console.log(`[Webhook Catch-all] POST request received with params:`, params.params);
  
  try {
    // Obtener los datos enviados por Rook
    const data = await request.json();
    
    // Crear logs detallados para inspeccionar los datos recibidos
    console.log('[Webhook Catch-all] Datos recibidos:', JSON.stringify(data, null, 2));
    
    // Verificar que tenemos los datos mínimos necesarios
    if (!data.user_id) {
      console.error('[Webhook Catch-all] Falta user_id en la solicitud');
      return NextResponse.json(
        { success: false, error: 'Falta user_id en la solicitud' },
        { status: 400 }
      );
    }
    
    // Extraer user_id y date si están disponibles
    const userId = data.user_id;
    const date = data.date || new Date().toISOString().split('T')[0];
    const type = data.type || 'unknown';
    
    // Registrar el webhook para análisis
    try {
      await logWebhookData(userId, type, data);
    } catch (logError) {
      console.error('[Webhook Catch-all] Error logging webhook data:', logError);
    }
    
    // Responder con éxito - Rook requiere un código 200, 201 o 202 para confirmar recepción
    return NextResponse.json({ success: true }, { status: 200 });
    
  } catch (error) {
    console.error('[Webhook Catch-all] Error general procesando el webhook:', error);
    // Responder con éxito incluso si hay error para evitar reintento
    return NextResponse.json(
      { success: true, warning: 'Error interno pero confirmando recepción' },
      { status: 200 }
    );
  }
}

/**
 * Registra los datos recibidos en el webhook para análisis posterior
 */
async function logWebhookData(userId: string, type: string, data: any, errorMessage?: string) {
  try {
    // Extraer la fecha de los datos si está disponible
    let dataDate = null;
    if (data.date) {
      dataDate = data.date;
    }
    
    // Verificar si ya existe un log para este documento
    const documentVersion = data.document_version || '1.0';
    const existingLog = await sql`
      SELECT id FROM processed_webhook_logs
      WHERE user_id = ${userId} 
        AND type = ${type}
        AND document_version = ${documentVersion}
      LIMIT 1
    `;
    
    if (existingLog.length > 0) {
      // Si ya existe, actualizamos el registro en lugar de insertar uno nuevo
      console.log(`[Webhook Catch-all] Actualizando log existente para usuario=${userId}, tipo=${type}, version=${documentVersion}`);
      await sql`
        UPDATE processed_webhook_logs
        SET 
          data_date = ${dataDate},
          webhook_status = ${errorMessage ? 'error' : 'success'},
          error_message = ${errorMessage || null},
          raw_payload = ${JSON.stringify(data)},
          processed_at = CURRENT_TIMESTAMP
        WHERE 
          user_id = ${userId} 
          AND type = ${type}
          AND document_version = ${documentVersion}
      `;
    } else {
      // Si no existe, insertamos un nuevo registro
      await sql`
        INSERT INTO processed_webhook_logs
          (user_id, type, data_date, document_version, webhook_status, error_message, raw_payload, processed_at)
        VALUES
          (${userId}, ${type}, ${dataDate}, ${documentVersion}, 
           ${errorMessage ? 'error' : 'success'}, ${errorMessage || null}, 
           ${JSON.stringify(data)}, CURRENT_TIMESTAMP)
      `;
    }
    
    console.log(`[Webhook Catch-all] Datos registrados en logs: usuario=${userId}, tipo=${type}`);
    return true;
  } catch (error) {
    console.error('[Webhook Catch-all] Error registrando datos en logs:', error);
    return false;
  }
} 