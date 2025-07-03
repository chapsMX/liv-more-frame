import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userFid = searchParams.get('user_fid') || '20701';

    console.log('📊 [WEBHOOK MONITORING V2] Checking webhook health for user:', userFid);

    // 1. Obtener timezone del usuario
    const userTimezoneData = await sql`
      SELECT timezone FROM user_goals WHERE user_fid = ${userFid} LIMIT 1
    `;
    
    const userTimezone = userTimezoneData[0]?.timezone || 'UTC';
    
    // 2. Calcular "today" según el timezone del usuario
    const now = new Date();
    const userToday = new Intl.DateTimeFormat('en-CA', { 
      timeZone: userTimezone 
    }).format(now);
    
    // ✅ MIGRATED: 3. Obtener datos recientes del usuario desde v2_daily_activities
    const recentData = await sql`
      SELECT 
        activity_date,
        processing_date,
        steps,
        calories,
        sleep_hours,
        data_source,
        rook_user_id,
        created_at,
        updated_at,
        EXTRACT(EPOCH FROM (NOW() - updated_at))/60 as minutes_since_update
      FROM v2_daily_activities 
      WHERE user_fid = ${userFid}
      ORDER BY activity_date DESC
      LIMIT 7
    `;

    // ✅ MIGRATED: 4. Obtener datos de hoy específicamente
    const todayData = await sql`
      SELECT 
        activity_date,
        processing_date,
        steps,
        calories,
        sleep_hours,
        data_source,
        rook_user_id,
        created_at,
        updated_at,
        EXTRACT(EPOCH FROM (NOW() - updated_at))/60 as minutes_since_update
      FROM v2_daily_activities 
      WHERE user_fid = ${userFid} AND activity_date = ${userToday}
      ORDER BY processing_date DESC
      LIMIT 1
    `;

    // 5. Calcular estadísticas de webhook health (enhanced for v2)
    const webhookHealth = {
      has_today_data: todayData.length > 0,
      today_last_update: todayData[0]?.minutes_since_update || null,
      data_freshness: todayData[0]?.minutes_since_update < 60 ? 'fresh' : 
                     todayData[0]?.minutes_since_update < 360 ? 'stale' : 'very_stale',
      total_recent_days: recentData.length,
      days_with_activity: recentData.filter(d => d.steps > 0 || d.calories > 0 || d.sleep_hours > 0).length,
      // ✅ NEW: Enhanced v2 metrics
      data_source_used: todayData[0]?.data_source || null,
      processing_delay: todayData[0] ? 
        Math.abs(new Date(todayData[0].activity_date).getTime() - new Date(todayData[0].processing_date).getTime()) / (1000 * 60 * 60 * 24) 
        : null,
      rook_user_id: todayData[0]?.rook_user_id || null
    };

    // 6. Análisis de timezone accuracy (enhanced)
    const timezoneAnalysis = {
      user_timezone: userTimezone,
      calculated_today: userToday,
      server_utc_today: new Date().toISOString().split('T')[0],
      timezone_offset_detected: userToday !== new Date().toISOString().split('T')[0],
      user_local_time: new Date().toLocaleString('en-US', { timeZone: userTimezone }),
      // ✅ NEW: V2 timezone handling
      activity_vs_processing_dates: todayData[0] ? {
        activity_date: todayData[0].activity_date,
        processing_date: todayData[0].processing_date,
        dates_match: todayData[0].activity_date === todayData[0].processing_date?.split('T')[0]
      } : null
    };

    // 7. Performance metrics
    const performanceMetrics = {
      api_response_time_start: Date.now(),
      database_queries_executed: 3,
      data_source: 'v2_daily_activities_via_webhook' // ✅ UPDATED
    };

    const response = {
      monitoring_info: {
        timestamp: new Date().toISOString(),
        user_fid: userFid,
        monitoring_type: 'webhook_health_check_v2', // ✅ UPDATED
        testing_week_day: Math.ceil((Date.now() - new Date('2025-07-01').getTime()) / (1000 * 60 * 60 * 24)),
        table_version: 'v2_daily_activities' // ✅ NEW
      },
      webhook_health: webhookHealth,
      timezone_analysis: timezoneAnalysis,
      recent_data: recentData,
      today_data: todayData[0] || null,
      performance_metrics: {
        ...performanceMetrics,
        api_response_time_ms: Date.now() - performanceMetrics.api_response_time_start
      },
      health_status: {
        overall: webhookHealth.has_today_data && webhookHealth.today_last_update < 360 ? 'healthy' : 'needs_attention',
        data_freshness: webhookHealth.data_freshness,
        timezone_accuracy: userToday === new Date().toISOString().split('T')[0] ? 'same_day' : 'cross_day_handled',
        date_handling: todayData[0]?.activity_date === todayData[0]?.processing_date?.split('T')[0] ? 'accurate' : 'separated', // ✅ NEW
        recommendations: webhookHealth.today_last_update > 360 ? 
          ['Check webhook endpoint status', 'Verify Rook API connectivity'] : 
          ['System operating normally']
      }
    };

    console.log('📊 [WEBHOOK MONITORING V2] Health check completed for user:', userFid);
    console.log('📊 [WEBHOOK MONITORING V2] Overall status:', response.health_status.overall);
    console.log('📊 [WEBHOOK MONITORING V2] Data source:', response.webhook_health.data_source_used);
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ [WEBHOOK MONITORING V2] Error:', error);
    return NextResponse.json(
      { 
        error: 'Error checking webhook health',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 