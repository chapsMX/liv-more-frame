import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

/**
 * Endpoint para probar el flujo completo de Rook
 * Este endpoint permite verificar cada paso del proceso de integración
 */
export async function GET(request: Request) {
  try {
    // Obtener parámetros
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    
    if (!user_fid) {
      return NextResponse.json({ 
        success: false, 
        error: 'user_fid es requerido' 
      }, { status: 400 });
    }
    
    // Paso 1: Verificar credenciales
    const rookClientUuid = process.env.ROOK_CLIENT_UUID;
    const rookClientSecret = process.env.ROOK_CLIENT_SECRET;
    
    if (!rookClientUuid || !rookClientSecret) {
      return NextResponse.json({
        success: false,
        step: 'verificación_credenciales',
        error: 'Credenciales de Rook no configuradas'
      }, { status: 500 });
    }
    
    // Paso 2: Verificar si el usuario existe
    const userInfo = await sql`
      SELECT id, username, display_name FROM whitelist_users
      WHERE user_fid = ${user_fid}
      LIMIT 1
    `;
    
    if (userInfo.length === 0) {
      return NextResponse.json({
        success: false,
        step: 'verificación_usuario',
        error: 'Usuario no encontrado'
      }, { status: 404 });
    }
    
    const userId = userInfo[0].id;
    
    // Paso 3: Verificar si hay una conexión con Rook
    const userConnection = await sql`
      SELECT * FROM user_connections
      WHERE user_fid = ${user_fid}
      LIMIT 1
    `;
    
    const isConnected = userConnection.length > 0 && userConnection[0].rook_user_id;
    const rookUserId = isConnected ? userConnection[0].rook_user_id : null;
    
    // Paso 4: Verificar datos locales
    const localData = await sql`
      SELECT * FROM daily_activities
      WHERE user_fid = ${user_fid} AND date = ${date}
      LIMIT 1
    `;
    
    const hasLocalData = localData.length > 0;
    
    // Paso 5: Consultar datos directamente de Rook (si está conectado)
    let rookPhysicalData = null;
    let rookSleepData = null;
    let rookSleepHealthData = null;
    
    if (isConnected) {
      // Preparar credenciales para Basic Authentication
      const credentials = Buffer.from(`${rookClientUuid}:${rookClientSecret}`).toString('base64');
      
      // Consultar datos físicos
      const physicalUrl = `https://api.rook-connect.review/v2/processed_data/physical_health/summary?user_id=${rookUserId}&date=${date}`;
      const physicalResponse = await fetch(physicalUrl, {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (physicalResponse.status === 200) {
        rookPhysicalData = await physicalResponse.json();
      }
      
      // Consultar datos de sueño
      const sleepUrl = `https://api.rook-connect.review/v2/processed_data/sleep/summary?user_id=${rookUserId}&date=${date}`;
      const sleepResponse = await fetch(sleepUrl, {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (sleepResponse.status === 200) {
        rookSleepData = await sleepResponse.json();
      }
      
      // Consultar datos de sleep_health (Fitbit)
      const sleepHealthUrl = `https://api.rook-connect.review/v2/processed_data/sleep_health/summary?user_id=${rookUserId}&date=${date}`;
      const sleepHealthResponse = await fetch(sleepHealthUrl, {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (sleepHealthResponse.status === 200) {
        rookSleepHealthData = await sleepHealthResponse.json();
      }
    }
    
    // Consultar webhooks procesados
    const webhookLogs = await sql`
      SELECT * FROM processed_webhook_logs
      WHERE user_id IN (${userId}::text, ${rookUserId || ''})
      ORDER BY processed_at DESC
      LIMIT 5
    `;
    
    // Construir respuesta
    const response = {
      success: true,
      user: {
        user_fid,
        whitelist_id: userId,
        username: userInfo[0].username,
        display_name: userInfo[0].display_name
      },
      connection: {
        connected: isConnected,
        rook_user_id: rookUserId,
        details: isConnected ? userConnection[0] : null
      },
      local_data: {
        exists: hasLocalData,
        data: hasLocalData ? localData[0] : null
      },
      rook_data: {
        physical: rookPhysicalData,
        sleep: rookSleepData,
        sleep_health: rookSleepHealthData
      },
      webhooks: webhookLogs,
      endpoints: {
        connect: `/api/rook/connect?user_fid=${user_fid}`,
        check_connection: `/api/rook/check-connection?user_fid=${user_fid}`,
        dashboard_data: `/api/rook/dashboard-data?user_fid=${user_fid}&date=${date}`,
        check_local_data: `/api/rook/check-local-data?user_fid=${user_fid}`
      }
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('[Test Flow] Error general:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 