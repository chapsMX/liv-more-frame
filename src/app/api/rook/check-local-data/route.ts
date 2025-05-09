import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    // Obtener parámetros
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const days = parseInt(searchParams.get('days') || '1', 10);

    if (!user_fid) {
      return NextResponse.json({ 
        success: false, 
        error: 'user_fid es requerido' 
      }, { status: 400 });
    }

    // Buscar datos en daily_activities
    const activityData = await sql`
      SELECT * FROM daily_activities 
      WHERE user_fid = ${user_fid}
      ORDER BY date DESC
      LIMIT ${days}
    `;
    
    // Buscar datos en webhook_logs
    const webhookLogs = await sql`
      SELECT * FROM processed_webhook_logs
      WHERE user_id IN (
        SELECT id::text FROM whitelist_users WHERE user_fid = ${user_fid}
        UNION
        SELECT rook_user_id FROM user_connections WHERE user_fid = ${user_fid}
      )
      ORDER BY processed_at DESC
      LIMIT 10
    `;
    
    // Buscar información de conexión
    const connectionData = await sql`
      SELECT * FROM user_connections
      WHERE user_fid = ${user_fid}
      LIMIT 1
    `;
    
    // Buscar información de usuario
    const userData = await sql`
      SELECT * FROM whitelist_users
      WHERE user_fid = ${user_fid}
      LIMIT 1
    `;

    return NextResponse.json({
      success: true,
      activity_data: activityData,
      webhook_logs: webhookLogs,
      connection_data: connectionData.length > 0 ? connectionData[0] : null,
      user_data: userData.length > 0 ? userData[0] : null,
      debug_info: {
        searched_user_fid: user_fid,
        searched_date: date,
        whitelist_id: userData.length > 0 ? userData[0].id : null,
        rook_user_id: connectionData.length > 0 ? connectionData[0].rook_user_id : null
      }
    });
  } catch (error) {
    console.error('[Check Local Data] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 