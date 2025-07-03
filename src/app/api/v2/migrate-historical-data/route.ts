import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

/**
 * 🚀 MIGRATION ENDPOINT: Populate v2_daily_activities with historical data from Rook
 * 
 * According to Rook docs, we can get up to 7 days of pre-existing data for API-based sources:
 * https://docs.tryrook.io/docs/rookconnect/add-ons/#pre-existing-data
 */
export async function POST(request: Request) {
  console.log('🔄 [MIGRATION] Starting historical data migration to v2_daily_activities...');
  
  try {
    const { force_refresh, specific_user_fid } = await request.json();
    
    // Get all users with active Rook connections
    let usersQuery;
    if (specific_user_fid) {
      usersQuery = await sql`
        SELECT user_fid, rook_user_id, data_sources
        FROM rook_connection 
        WHERE user_fid = ${specific_user_fid} 
          AND connection_status = 'active'
      `;
    } else {
      usersQuery = await sql`
        SELECT user_fid, rook_user_id, data_sources
        FROM rook_connection 
        WHERE connection_status = 'active'
      `;
    }
    
    console.log(`👥 [MIGRATION] Found ${usersQuery.length} users with active Rook connections`);
    
    let totalMigrated = 0;
    let totalErrors = 0;
    const migrationResults = [];
    
    for (const user of usersQuery) {
      try {
        console.log(`📊 [MIGRATION] Processing user ${user.user_fid} (rook_user_id: ${user.rook_user_id})`);
        
        const result = await migrateUserHistoricalData(
          user.user_fid, 
          user.rook_user_id, 
          user.data_sources,
          force_refresh
        );
        
        totalMigrated += result.days_migrated;
        migrationResults.push({
          user_fid: user.user_fid,
          rook_user_id: user.rook_user_id,
          ...result
        });
        
        console.log(`✅ [MIGRATION] User ${user.user_fid}: ${result.days_migrated} days migrated`);
        
      } catch (error) {
        totalErrors++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ [MIGRATION] Error processing user ${user.user_fid}:`, errorMessage);
        
        migrationResults.push({
          user_fid: user.user_fid,
          error: errorMessage,
          days_migrated: 0
        });
      }
    }
    
    console.log(`🎉 [MIGRATION] Migration completed: ${totalMigrated} total days migrated, ${totalErrors} errors`);
    
    return NextResponse.json({
      success: true,
      migration_summary: {
        total_users_processed: usersQuery.length,
        total_days_migrated: totalMigrated,
        total_errors: totalErrors,
        force_refresh: force_refresh || false,
        specific_user_fid: specific_user_fid || null
      },
      results: migrationResults
    });
    
  } catch (error) {
    console.error('❌ [MIGRATION] Fatal error during migration:', error);
    return NextResponse.json(
      { 
        error: 'Migration failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

/**
 * Migrate historical data for a single user
 */
async function migrateUserHistoricalData(
  userFid: string, 
  rookUserId: string, 
  dataSources: any,
  forceRefresh: boolean = false
): Promise<{ days_migrated: number; skipped: number; errors: number; debug_info?: any }> {
  
  // Get user timezone for proper date handling
  const userTimezoneData = await sql`
    SELECT timezone FROM user_goals WHERE user_fid = ${userFid} LIMIT 1
  `;
  const userTimezone = userTimezoneData[0]?.timezone || 'UTC';
  
  // 🔍 DEBUG: Log current date and timezone
  const now = new Date();
  console.log(`🕐 [MIGRATION DEBUG] Current date: ${now.toISOString()}`);
  console.log(`🌍 [MIGRATION DEBUG] User timezone: ${userTimezone}`);
  
  // Calculate date range: 7 days back from today (Rook pre-existing data limit)
  const today = new Date();
  const dates: string[] = [];
  
  for (let i = 7; i >= 1; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateString = new Intl.DateTimeFormat('en-CA', { 
      timeZone: userTimezone 
    }).format(date);
    dates.push(dateString);
    
    // 🔍 DEBUG: Log each calculated date
    console.log(`📅 [MIGRATION DEBUG] Day -${i}: ${date.toISOString()} -> ${dateString}`);
  }
  
  console.log(`📅 [MIGRATION] User ${userFid}: Migrating dates ${dates[0]} to ${dates[dates.length - 1]}`);
  console.log(`🔍 [MIGRATION DEBUG] All dates: ${JSON.stringify(dates)}`);
  
  let daysMigrated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const date of dates) {
    try {
      console.log(`🔍 [MIGRATION DEBUG] Processing date: ${date} for user ${userFid}`);
      
      // Check if we already have data for this date (skip if not forcing refresh)
      if (!forceRefresh) {
        const existingData = await sql`
          SELECT id FROM v2_daily_activities 
          WHERE user_fid = ${userFid} AND activity_date = ${date}
          LIMIT 1
        `;
        
        if (existingData.length > 0) {
          console.log(`⏭️ [MIGRATION] User ${userFid}, date ${date}: Already exists, skipping`);
          skipped++;
          continue;
        }
      }
      
      // 🔍 DEBUG: Log API URLs being called
      console.log(`🔍 [MIGRATION DEBUG] Fetching data for:
        - Physical: ${process.env.NEXT_PUBLIC_BASE_URL}/api/users/physical-summary?user_id=${rookUserId}&date=${date}
        - Sleep: ${process.env.NEXT_PUBLIC_BASE_URL}/api/users/sleep-summary?user_id=${rookUserId}&date=${date}`);
      
      // Fetch data from Rook for this date
      const [physicalData, sleepData] = await Promise.all([
        fetchRookPhysicalSummary(rookUserId, date),
        fetchRookSleepSummary(rookUserId, date)
      ]);
      
      // 🔍 DEBUG: Log fetched data
      console.log(`🔍 [MIGRATION DEBUG] Data fetched for ${date}:
        - Physical: ${JSON.stringify(physicalData)}
        - Sleep: ${JSON.stringify(sleepData)}`);
      
      // Determine data source from the data or user's connected sources
      const dataSource = determineDataSource(physicalData, sleepData, dataSources);
      
      // Prepare data for insertion
      const activityData = {
        steps: physicalData?.steps || 0,
        calories: physicalData?.calories || 0,
        sleep_hours: sleepData?.sleep_duration_hours || 0,
        distance_meters: physicalData?.distance_meters || 0
      };
      
      console.log(`🔍 [MIGRATION DEBUG] Activity data prepared: ${JSON.stringify(activityData)}`);
      
      // Insert into v2_daily_activities
      await insertV2DailyActivity(
        userFid, 
        date, // activity_date
        new Date().toISOString().split('T')[0], // processing_date (today)
        activityData,
        dataSource,
        rookUserId,
        { migration: true, source: 'historical_migration' }
      );
      
      daysMigrated++;
      console.log(`✅ [MIGRATION] User ${userFid}, date ${date}: Migrated successfully with ${activityData.steps} steps, ${activityData.calories} calories`);
      
    } catch (error) {
      errors++;
      console.error(`❌ [MIGRATION] User ${userFid}, date ${date}: Error -`, error);
    }
  }
  
  return { 
    days_migrated: daysMigrated, 
    skipped, 
    errors,
    debug_info: {
      user_timezone: userTimezone,
      current_date: now.toISOString(),
      calculated_dates: dates,
      processing_date: new Date().toISOString().split('T')[0]
    }
  };
}

/**
 * Fetch physical summary from Rook API
 */
async function fetchRookPhysicalSummary(rookUserId: string, date: string) {
  try {
    const response = await fetch(`https://a27285efd6eb.ngrok.app/api/users/physical-summary?user_id=${rookUserId}&date=${date}`);
    
    if (response.ok) {
      return await response.json();
    } else if (response.status === 204) {
      // No data available for this date
      return null;
    } else {
      throw new Error(`Physical summary API error: ${response.status}`);
    }
  } catch (error) {
    console.warn(`⚠️ [MIGRATION] Could not fetch physical data for ${rookUserId} on ${date}:`, error);
    return null;
  }
}

/**
 * Fetch sleep summary from Rook API
 */
async function fetchRookSleepSummary(rookUserId: string, date: string) {
  try {
    const response = await fetch(`https://a27285efd6eb.ngrok.app/api/users/sleep-summary?user_id=${rookUserId}&date=${date}`);
    
    if (response.ok) {
      return await response.json();
    } else if (response.status === 204) {
      // No data available for this date
      return null;
    } else {
      throw new Error(`Sleep summary API error: ${response.status}`);
    }
  } catch (error) {
    console.warn(`⚠️ [MIGRATION] Could not fetch sleep data for ${rookUserId} on ${date}:`, error);
    return null;
  }
}

/**
 * Determine data source from available data
 */
function determineDataSource(physicalData: any, sleepData: any, userDataSources: any): string {
  // Try to get from actual data first
  if (physicalData?.data_source) return physicalData.data_source;
  if (sleepData?.data_source) return sleepData.data_source;
  
  // Fallback to user's connected sources
  if (userDataSources && Array.isArray(userDataSources) && userDataSources.length > 0) {
    return userDataSources[0];
  }
  
  return 'unknown';
}

/**
 * Insert data into v2_daily_activities
 */
async function insertV2DailyActivity(
  userFid: string,
  activityDate: string,
  processingDate: string,
  data: any,
  dataSource: string,
  rookUserId: string,
  metadata: any
) {
  await sql`
    INSERT INTO v2_daily_activities (
      user_fid,
      activity_date,
      processing_date,
      steps,
      calories,
      sleep_hours,
      distance_meters,
      data_source,
      rook_user_id,
      webhook_metadata,
      created_at,
      updated_at
    ) VALUES (
      ${userFid},
      ${activityDate},
      ${processingDate},
      ${data.steps || 0},
      ${data.calories || 0},
      ${data.sleep_hours || 0},
      ${data.distance_meters || 0},
      ${dataSource},
      ${rookUserId},
      ${JSON.stringify(metadata)}::jsonb,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (user_fid, activity_date) 
    DO UPDATE SET
      steps = EXCLUDED.steps,
      calories = EXCLUDED.calories,
      sleep_hours = EXCLUDED.sleep_hours,
      distance_meters = EXCLUDED.distance_meters,
      processing_date = EXCLUDED.processing_date,
      data_source = EXCLUDED.data_source,
      rook_user_id = EXCLUDED.rook_user_id,
      webhook_metadata = EXCLUDED.webhook_metadata,
      updated_at = CURRENT_TIMESTAMP
      -- Note: completion fields will be auto-calculated by the database trigger
  `;
} 