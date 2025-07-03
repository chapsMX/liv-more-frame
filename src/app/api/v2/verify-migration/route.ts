import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

/**
 * 🧹 CLEANUP ENDPOINT: Remove test data from v2_daily_activities
 */
export async function DELETE(request: Request) {
  console.log('🧹 [CLEANUP] Starting test data cleanup...');
  
  try {
    const { user_fid, activity_date, test_data_only } = await request.json();
    
    if (!user_fid || !activity_date) {
      return NextResponse.json(
        { error: 'user_fid and activity_date are required' },
        { status: 400 }
      );
    }

    console.log(`🧹 [CLEANUP] Cleaning data for user ${user_fid} on ${activity_date}`);

    let deletedRows = 0;

    if (test_data_only) {
      // Delete only if it looks like test data (9999 steps, 2999 calories)
      const result = await sql`
        DELETE FROM v2_daily_activities 
        WHERE user_fid = ${user_fid} 
          AND activity_date = ${activity_date}
          AND (steps = 9999 OR calories = 2999)
        RETURNING *
      `;
      deletedRows = result.length;
      console.log(`🧹 [CLEANUP] Deleted ${deletedRows} test data rows`);
    } else {
      // Delete all data for that date
      const result = await sql`
        DELETE FROM v2_daily_activities 
        WHERE user_fid = ${user_fid} 
          AND activity_date = ${activity_date}
        RETURNING *
      `;
      deletedRows = result.length;
      console.log(`🧹 [CLEANUP] Deleted ${deletedRows} rows for ${activity_date}`);
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned ${deletedRows} rows from v2_daily_activities`,
      user_fid,
      activity_date,
      deleted_rows: deletedRows
    });
    
  } catch (error) {
    console.error('❌ [CLEANUP] Error during cleanup:', error);
    return NextResponse.json(
      { 
        error: 'Cleanup failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

/**
 * 🔍 VERIFICATION ENDPOINT: Check migrated data in v2_daily_activities
 */
export async function GET(request: Request) {
  console.log('🔍 [VERIFICATION] Starting data verification...');
  
  try {
    // 1. General migration statistics
    const generalStats = await sql`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT user_fid) as unique_users,
        MIN(activity_date) as earliest_date,
        MAX(activity_date) as latest_date,
        COUNT(*) FILTER (WHERE steps > 0) as records_with_steps,
        COUNT(*) FILTER (WHERE calories > 0) as records_with_calories,
        COUNT(*) FILTER (WHERE sleep_hours > 0) as records_with_sleep,
        COUNT(*) FILTER (WHERE all_completed = true) as days_all_goals_completed,
        COUNT(*) FILTER (WHERE steps_completed = true) as days_steps_completed,
        COUNT(*) FILTER (WHERE calories_completed = true) as days_calories_completed,
        COUNT(*) FILTER (WHERE sleep_completed = true) as days_sleep_completed
      FROM v2_daily_activities
    `;

    // 2. Sample of real data (non-zero values)
    const realDataSample = await sql`
      SELECT 
        user_fid,
        activity_date,
        steps, calories, sleep_hours,
        steps_completed, calories_completed, sleep_completed, all_completed,
        data_source,
        processing_date,
        LEFT(webhook_metadata::text, 100) as metadata_sample
      FROM v2_daily_activities 
      WHERE steps > 0 OR calories > 0 OR sleep_hours > 0
      ORDER BY activity_date DESC, steps DESC
      LIMIT 15
    `;

    // 3. Users with most activity
    const topUsers = await sql`
      SELECT 
        user_fid,
        COUNT(*) as days_recorded,
        AVG(steps)::int as avg_steps,
        AVG(calories)::int as avg_calories,
        AVG(sleep_hours)::decimal(3,1) as avg_sleep_hours,
        COUNT(*) FILTER (WHERE all_completed = true) as days_completed,
        COUNT(*) FILTER (WHERE steps > 0) as days_with_steps,
        MAX(steps) as max_steps,
        MAX(calories) as max_calories
      FROM v2_daily_activities 
      WHERE steps > 0 OR calories > 0
      GROUP BY user_fid
      ORDER BY avg_steps DESC
      LIMIT 10
    `;

    // 4. Data source distribution
    const dataSourceStats = await sql`
      SELECT 
        data_source,
        COUNT(*) as records_count,
        COUNT(DISTINCT user_fid) as unique_users,
        AVG(steps)::int as avg_steps,
        AVG(calories)::int as avg_calories,
        COUNT(*) FILTER (WHERE steps > 0) as records_with_data
      FROM v2_daily_activities
      WHERE data_source IS NOT NULL
      GROUP BY data_source
      ORDER BY records_count DESC
    `;

    // 5. Date distribution
    const dateStats = await sql`
      SELECT 
        activity_date,
        COUNT(*) as users_count,
        COUNT(*) FILTER (WHERE steps > 0) as users_with_steps,
        COUNT(*) FILTER (WHERE calories > 0) as users_with_calories,
        COUNT(*) FILTER (WHERE all_completed = true) as users_completed_all,
        AVG(steps)::int as avg_steps,
        AVG(calories)::int as avg_calories
      FROM v2_daily_activities
      GROUP BY activity_date
      ORDER BY activity_date DESC
    `;

    // 6. Completion analysis by user goals
    const completionAnalysis = await sql`
      SELECT 
        v.user_fid,
        g.steps_goal,
        g.calories_goal,
        g.sleep_hours_goal,
        COUNT(*) as total_days,
        COUNT(*) FILTER (WHERE v.steps_completed = true) as days_steps_goal_met,
        COUNT(*) FILTER (WHERE v.calories_completed = true) as days_calories_goal_met,
        COUNT(*) FILTER (WHERE v.sleep_completed = true) as days_sleep_goal_met,
        COUNT(*) FILTER (WHERE v.all_completed = true) as days_all_goals_met,
        ROUND(COUNT(*) FILTER (WHERE v.all_completed = true) * 100.0 / COUNT(*), 2) as completion_percentage
      FROM v2_daily_activities v
      LEFT JOIN user_goals g ON v.user_fid = g.user_fid
      WHERE v.steps > 0 OR v.calories > 0  -- Only users with actual data
      GROUP BY v.user_fid, g.steps_goal, g.calories_goal, g.sleep_hours_goal
      HAVING COUNT(*) > 0
      ORDER BY completion_percentage DESC, days_all_goals_met DESC
      LIMIT 15
    `;

    // 7. Check for zero-data records (should be minimal after migration)
    const zeroDataRecords = await sql`
      SELECT 
        COUNT(*) as zero_data_count,
        COUNT(DISTINCT user_fid) as users_with_zero_data
      FROM v2_daily_activities
      WHERE steps = 0 AND calories = 0 AND sleep_hours = 0
    `;

    const response = {
      verification_timestamp: new Date().toISOString(),
      migration_health: 'completed',
      
      general_statistics: generalStats[0],
      
      real_data_sample: realDataSample,
      
      top_active_users: topUsers,
      
      data_source_distribution: dataSourceStats,
      
      daily_distribution: dateStats,
      
      completion_analysis: completionAnalysis,
      
      data_quality: {
        zero_data_records: zeroDataRecords[0],
        data_coverage_percentage: Math.round((generalStats[0].records_with_steps / generalStats[0].total_records) * 100),
        completion_rate: Math.round((generalStats[0].days_all_goals_completed / generalStats[0].total_records) * 100)
      },
      
      summary: {
        migration_success: generalStats[0].total_records > 0,
        has_real_data: generalStats[0].records_with_steps > 0,
        completion_fields_working: generalStats[0].days_all_goals_completed > 0,
        multiple_data_sources: dataSourceStats.length > 1,
        recommendation: generalStats[0].records_with_steps > generalStats[0].total_records * 0.3 
          ? "Migration successful - good data coverage" 
          : "Migration completed but low data coverage - may need data source review"
      }
    };

    console.log('✅ [VERIFICATION] Data verification completed successfully');
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ [VERIFICATION] Error during verification:', error);
    return NextResponse.json(
      { 
        error: 'Verification failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 