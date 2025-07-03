import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userFid = searchParams.get('user_fid');

    if (!userFid) {
      return NextResponse.json(
        { error: 'user_fid parameter is required' },
        { status: 400 }
      );
    }

    console.log('📊 [Personal Records] Obteniendo records para usuario:', userFid);

    // ✅ NEW: Obtener timezone del usuario para cálculos precisos
    const userTimezoneData = await sql`
      SELECT timezone FROM user_goals WHERE user_fid = ${userFid} LIMIT 1
    `;
    
    const userTimezone = userTimezoneData[0]?.timezone || 'UTC';
    
    // ✅ UPDATED: Calcular fechas según timezone del usuario
    const now = new Date();
    
    // TODAY en timezone del usuario
    const userToday = new Intl.DateTimeFormat('en-CA', { 
      timeZone: userTimezone 
    }).format(now);
    
    // YESTERDAY en timezone del usuario (para consistencia con dashboard)
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const userYesterday = new Intl.DateTimeFormat('en-CA', { 
      timeZone: userTimezone 
    }).format(yesterday);
    
    // START OF WEEK (Monday) en timezone del usuario
    const userDateObj = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
    const dayOfWeek = userDateObj.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(userDateObj);
    startOfWeek.setDate(userDateObj.getDate() - daysFromMonday);
    const weekStart = new Intl.DateTimeFormat('en-CA', { 
      timeZone: userTimezone 
    }).format(startOfWeek);
    
    // START OF MONTH en timezone del usuario
    const startOfMonth = new Date(userDateObj.getFullYear(), userDateObj.getMonth(), 1);
    const monthStart = new Intl.DateTimeFormat('en-CA', { 
      timeZone: userTimezone 
    }).format(startOfMonth);
    
    console.log('🕐 [Personal Records] Fechas calculadas:', {
      timezone: userTimezone,
      today: userToday,
      yesterday: userYesterday,
      weekStart,
      monthStart
    });

    // ✅ UPDATED: Get yesterday's data (consistent with dashboard)
    const yesterdayResult = await sql`
      SELECT steps, calories, sleep_hours 
      FROM v2_daily_activities 
      WHERE user_fid = ${userFid} AND activity_date = ${userYesterday}
    `;

    // ✅ UPDATED: Get MAXIMUM weekly totals (historical record)
    const maxWeeklyResult = await sql`
      WITH weekly_totals AS (
        SELECT 
          date_trunc('week', activity_date) as week_start,
          SUM(steps) as week_steps,
          SUM(calories) as week_calories,
          AVG(sleep_hours) as avg_week_sleep,
          MAX(sleep_hours) as max_week_sleep
        FROM v2_daily_activities 
        WHERE user_fid = ${userFid}
        GROUP BY date_trunc('week', activity_date)
      )
      SELECT 
        COALESCE(MAX(week_steps), 0) as max_weekly_steps,
        COALESCE(MAX(week_calories), 0) as max_weekly_calories,
        COALESCE(MAX(avg_week_sleep), 0) as max_avg_weekly_sleep,
        COALESCE(MAX(max_week_sleep), 0) as max_weekly_sleep
      FROM weekly_totals
    `;

    // ✅ UPDATED: Get MAXIMUM monthly totals (historical record)
    const maxMonthlyResult = await sql`
      WITH monthly_totals AS (
        SELECT 
          date_trunc('month', activity_date) as month_start,
          SUM(steps) as month_steps,
          SUM(calories) as month_calories,
          AVG(sleep_hours) as avg_month_sleep,
          MAX(sleep_hours) as max_month_sleep
        FROM v2_daily_activities 
        WHERE user_fid = ${userFid}
        GROUP BY date_trunc('month', activity_date)
      )
      SELECT 
        COALESCE(MAX(month_steps), 0) as max_monthly_steps,
        COALESCE(MAX(month_calories), 0) as max_monthly_calories,
        COALESCE(MAX(avg_month_sleep), 0) as max_avg_monthly_sleep,
        COALESCE(MAX(max_month_sleep), 0) as max_monthly_sleep
      FROM monthly_totals
    `;

    // ✅ UPDATED: Get all-time max records (including sleep)
    const maxResult = await sql`
      SELECT 
        COALESCE(MAX(steps), 0) as max_steps,
        COALESCE(MAX(calories), 0) as max_calories,
        COALESCE(MAX(sleep_hours), 0) as max_sleep
      FROM v2_daily_activities 
      WHERE user_fid = ${userFid}
    `;

    // ✅ UPDATED: Get max dates for all metrics
    const maxStepsDateResult = await sql`
      SELECT activity_date as max_steps_date
      FROM v2_daily_activities 
      WHERE user_fid = ${userFid} AND steps = (SELECT MAX(steps) FROM v2_daily_activities WHERE user_fid = ${userFid})
      LIMIT 1
    `;

    const maxCaloriesDateResult = await sql`
      SELECT activity_date as max_calories_date
      FROM v2_daily_activities 
      WHERE user_fid = ${userFid} AND calories = (SELECT MAX(calories) FROM v2_daily_activities WHERE user_fid = ${userFid})
      LIMIT 1
    `;

    const maxSleepDateResult = await sql`
      SELECT activity_date as max_sleep_date
      FROM v2_daily_activities 
      WHERE user_fid = ${userFid} AND sleep_hours = (SELECT MAX(sleep_hours) FROM v2_daily_activities WHERE user_fid = ${userFid})
      LIMIT 1
    `;

    // ✅ ENHANCED: Combine results with sleep data
    const yesterdaySteps = yesterdayResult.length > 0 ? (yesterdayResult[0].steps || 0) : 0;
    const yesterdayCalories = yesterdayResult.length > 0 ? (yesterdayResult[0].calories || 0) : 0;
    const yesterdaySleep = yesterdayResult.length > 0 ? (yesterdayResult[0].sleep_hours || 0) : 0;
    
    const weeklySteps = maxWeeklyResult.length > 0 ? Number(maxWeeklyResult[0].max_weekly_steps || 0) : 0;
    const weeklyCalories = maxWeeklyResult.length > 0 ? Number(maxWeeklyResult[0].max_weekly_calories || 0) : 0;
    const avgWeeklySleep = maxWeeklyResult.length > 0 ? Number(maxWeeklyResult[0].max_avg_weekly_sleep || 0) : 0;
    const maxWeeklySleep = maxWeeklyResult.length > 0 ? Number(maxWeeklyResult[0].max_weekly_sleep || 0) : 0;
    
    const monthlySteps = maxMonthlyResult.length > 0 ? Number(maxMonthlyResult[0].max_monthly_steps || 0) : 0;
    const monthlyCalories = maxMonthlyResult.length > 0 ? Number(maxMonthlyResult[0].max_monthly_calories || 0) : 0;
    const avgMonthlySleep = maxMonthlyResult.length > 0 ? Number(maxMonthlyResult[0].max_avg_monthly_sleep || 0) : 0;
    const maxMonthlySleep = maxMonthlyResult.length > 0 ? Number(maxMonthlyResult[0].max_monthly_sleep || 0) : 0;
    
    const maxSteps = maxResult.length > 0 ? (maxResult[0].max_steps || 0) : 0;
    const maxCalories = maxResult.length > 0 ? (maxResult[0].max_calories || 0) : 0;
    const maxSleep = maxResult.length > 0 ? Number(maxResult[0].max_sleep || 0) : 0;
    
    const maxStepsDate = maxStepsDateResult.length > 0 ? maxStepsDateResult[0].max_steps_date : null;
    const maxCaloriesDate = maxCaloriesDateResult.length > 0 ? maxCaloriesDateResult[0].max_calories_date : null;
    const maxSleepDate = maxSleepDateResult.length > 0 ? maxSleepDateResult[0].max_sleep_date : null;
    
    const response = {
      // ✅ UPDATED: Yesterday's data (consistent with dashboard)
      yesterday_steps: yesterdaySteps,
      yesterday_calories: yesterdayCalories,
      yesterday_sleep: Math.round(yesterdaySleep * 10) / 10, // Round to 1 decimal
      
      // Weekly totals
      weekly_steps: weeklySteps,
      weekly_calories: weeklyCalories,
      weekly_avg_sleep: Math.round(avgWeeklySleep * 10) / 10,
      weekly_max_sleep: Math.round(maxWeeklySleep * 10) / 10,
      
      // Monthly totals
      monthly_steps: monthlySteps,
      monthly_calories: monthlyCalories,
      monthly_avg_sleep: Math.round(avgMonthlySleep * 10) / 10,
      monthly_max_sleep: Math.round(maxMonthlySleep * 10) / 10,
      
      // All-time records
      max_steps: maxSteps,
      max_calories: maxCalories,
      max_sleep: Math.round(maxSleep * 10) / 10,
      max_steps_date: maxStepsDate,
      max_calories_date: maxCaloriesDate,
      max_sleep_date: maxSleepDate,
      
      // ✅ NEW: Metadata
      user_timezone: userTimezone,
      calculation_dates: {
        yesterday: userYesterday,
        week_start: weekStart,
        month_start: monthStart
      },
      data_source: 'v2_daily_activities'
    };

    console.log('✅ [Personal Records] Records calculados exitosamente');
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ [Personal Records] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personal records' },
      { status: 500 }
    );
  }
} 