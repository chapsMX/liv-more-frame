import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

/**
 * Esta ruta específica maneja el patrón de URL que Rook está utilizando para enviar webhooks:
 * /api/rook/webhook/client_uuid/{client_uuid}/user_id/{user_id}
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { client_uuid: string; user_id: string } }
) {
  console.log(`[Webhook Specific] GET request received with params:`, params);
  
  return NextResponse.json({
    success: true,
    message: 'Webhook endpoint específico configurado correctamente',
    params: params,
    path: request.url
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { client_uuid: string; user_id: string } }
) {
  console.log(`[Webhook Specific] POST request received with params:`, params);
  
  try {
    // Extraer los parámetros de la ruta
    const { client_uuid, user_id } = params;
    
    console.log(`[Webhook Specific] client_uuid: ${client_uuid}, user_id: ${user_id}`);
    
    // Obtener los datos enviados por Rook
    let data;
    try {
      data = await request.json();
    } catch (parseError) {
      console.log('[Webhook Specific] No hay cuerpo JSON en la solicitud o es inválido');
      data = {};
    }
    
    // Agregar los parámetros de la ruta al objeto de datos
    data.client_uuid = client_uuid;
    data.user_id = user_id;
    
    // Crear logs detallados para inspeccionar los datos recibidos
    console.log('[Webhook Specific] Datos completos:', JSON.stringify(data, null, 2));
    
    // Registrar el webhook para análisis
    try {
      await logWebhookData(user_id, data.type || 'unknown', data);
    } catch (logError) {
      console.error('[Webhook Specific] Error logging webhook data:', logError);
    }
    
    // Verificar si existe user_fid para este user_id de Rook
    const userFid = await getUserFidFromRookId(user_id);
    
    if (userFid) {
      console.log(`[Webhook Specific] Encontrado user_fid: ${userFid} para user_id: ${user_id}`);
      
      // Actualizar daily_activities con datos genéricos (para probar)
      const today = new Date().toISOString().split('T')[0];
      
      try {
        // Obtener datos actuales si existen
        const existingRecord = await sql`
          SELECT id FROM daily_activities
          WHERE user_fid = ${userFid} AND date = ${today}
          LIMIT 1
        `;
        
        if (existingRecord.length > 0) {
          await sql`
            UPDATE daily_activities
            SET 
              updated_at = CURRENT_TIMESTAMP
            WHERE user_fid = ${userFid} AND date = ${today}
          `;
        } else {
          await sql`
            INSERT INTO daily_activities
              (user_fid, date, steps, calories, sleep_hours, created_at, updated_at)
            VALUES
              (${userFid}, ${today}, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `;
        }
        
        console.log(`[Webhook Specific] Actualizado/creado registro en daily_activities para user_fid: ${userFid}`);
      } catch (dbError) {
        console.error('[Webhook Specific] Error de base de datos:', dbError);
      }
    } else {
      console.warn(`[Webhook Specific] No se encontró user_fid para user_id: ${user_id}`);
    }
    
    // Responder con éxito - Rook requiere un código 200, 201 o 202 para confirmar recepción
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[Webhook Specific] Error general:', error);
    // Responder con éxito incluso si hay error para evitar reintento
    return NextResponse.json(
      { success: true, warning: 'Error interno pero confirmando recepción' },
      { status: 200 }
    );
  }
}

/**
 * Obtiene el user_fid de nuestro sistema a partir del user_id de Rook
 */
async function getUserFidFromRookId(rookUserId: string): Promise<string | null> {
  try {
    // Primero intentar buscar en la tabla de conexiones
    const result = await sql`
      SELECT user_fid FROM user_connections 
      WHERE rook_user_id = ${rookUserId}
      LIMIT 1
    `;
    
    if (result.length > 0) {
      return result[0].user_fid;
    }
    
    // Si no lo encontramos, intentamos buscar por id en whitelist_users
    // Esto es porque el user_id que Rook envía en el webhook podría ser el id de whitelist_users
    const backupResult = await sql`
      SELECT user_fid FROM whitelist_users 
      WHERE id = ${rookUserId}
      LIMIT 1
    `;
    
    if (backupResult.length > 0) {
      return backupResult[0].user_fid;
    }
    
    return null;
  } catch (error) {
    console.error('[Webhook Specific] Error buscando user_fid:', error);
    return null;
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
    
    // Guardar el evento en la tabla de logs
    await sql`
      INSERT INTO processed_webhook_logs
        (user_id, type, data_date, document_version, webhook_status, error_message, raw_payload, processed_at)
      VALUES
        (${userId}, ${type}, ${dataDate}, ${data.document_version || '1.0'}, 
         ${errorMessage ? 'error' : 'success'}, ${errorMessage || null}, 
         ${JSON.stringify(data)}, CURRENT_TIMESTAMP)
    `;
    
    console.log(`[Webhook Specific] Datos registrados en logs: usuario=${userId}, tipo=${type}`);
    return true;
  } catch (error) {
    console.error('[Webhook Specific] Error registrando datos en logs:', error);
    return false;
  }
} 