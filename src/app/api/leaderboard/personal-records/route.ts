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

    // Get current date and time boundaries
    const now = new Date();
    const today = now.getFullYear() + '-' + 
                 String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                 String(now.getDate()).padStart(2, '0');
    
    // Calculate start of current week (Monday)
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday to 6, keep others as dayOfWeek - 1
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - daysFromMonday);
    startOfWeek.setHours(0, 0, 0, 0); // Start of day
    const weekStart = startOfWeek.getFullYear() + '-' + 
                     String(startOfWeek.getMonth() + 1).padStart(2, '0') + '-' + 
                     String(startOfWeek.getDate()).padStart(2, '0');
    
    // Calculate start of current month  
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0); // Start of day
    // Ensure we format in local timezone
    const monthStart = startOfMonth.getFullYear() + '-' + 
                      String(startOfMonth.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(startOfMonth.getDate()).padStart(2, '0');
    
    // Calculate the end of today for proper ranges (same as today for date comparison)
    const todayEnd = today;



    // Get daily data
    const dailyResult = await sql`
      SELECT steps, calories 
      FROM daily_activities 
      WHERE user_fid = ${userFid} AND date = ${today}
    `;

    // Get weekly data (current week only: from Monday to today)
    const weeklyResult = await sql`
      SELECT COALESCE(SUM(steps), 0) as weekly_steps, COALESCE(SUM(calories), 0) as weekly_calories
      FROM daily_activities 
      WHERE user_fid = ${userFid} 
        AND date >= ${weekStart} 
        AND date <= ${todayEnd}
    `;

    // Get monthly data (current month only: from 1st to today)
    const monthlyResult = await sql`
      SELECT COALESCE(SUM(steps), 0) as monthly_steps, COALESCE(SUM(calories), 0) as monthly_calories
      FROM daily_activities 
      WHERE user_fid = ${userFid} 
        AND date >= ${monthStart} 
        AND date <= ${todayEnd}
    `;

    // Get max records
    const maxResult = await sql`
      SELECT 
        COALESCE(MAX(steps), 0) as max_steps,
        COALESCE(MAX(calories), 0) as max_calories
      FROM daily_activities 
      WHERE user_fid = ${userFid}
    `;

    // Get max dates
    const maxStepsDateResult = await sql`
      SELECT date as max_steps_date
      FROM daily_activities 
      WHERE user_fid = ${userFid} AND steps = (SELECT MAX(steps) FROM daily_activities WHERE user_fid = ${userFid})
      LIMIT 1
    `;

    const maxCaloriesDateResult = await sql`
      SELECT date as max_calories_date
      FROM daily_activities 
      WHERE user_fid = ${userFid} AND calories = (SELECT MAX(calories) FROM daily_activities WHERE user_fid = ${userFid})
      LIMIT 1
    `;

    // Combine results
    const dailySteps = dailyResult.length > 0 ? (dailyResult[0].steps || 0) : 0;
    const dailyCalories = dailyResult.length > 0 ? (dailyResult[0].calories || 0) : 0;
    const weeklySteps = weeklyResult.length > 0 ? Number(weeklyResult[0].weekly_steps || 0) : 0;
    const weeklyCalories = weeklyResult.length > 0 ? Number(weeklyResult[0].weekly_calories || 0) : 0;
    const monthlySteps = monthlyResult.length > 0 ? Number(monthlyResult[0].monthly_steps || 0) : 0;
    const monthlyCalories = monthlyResult.length > 0 ? Number(monthlyResult[0].monthly_calories || 0) : 0;
    const maxSteps = maxResult.length > 0 ? (maxResult[0].max_steps || 0) : 0;
    const maxCalories = maxResult.length > 0 ? (maxResult[0].max_calories || 0) : 0;
    const maxStepsDate = maxStepsDateResult.length > 0 ? maxStepsDateResult[0].max_steps_date : null;
    const maxCaloriesDate = maxCaloriesDateResult.length > 0 ? maxCaloriesDateResult[0].max_calories_date : null;
    
    return NextResponse.json({
      daily_steps: dailySteps,
      daily_calories: dailyCalories,
      weekly_steps: weeklySteps,
      weekly_calories: weeklyCalories,
      monthly_steps: monthlySteps,
      monthly_calories: monthlyCalories,
      max_steps: maxSteps,
      max_calories: maxCalories,
      max_steps_date: maxStepsDate,
      max_calories_date: maxCaloriesDate
    });

  } catch (error) {
    console.error('❌ Error fetching personal records:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personal records' },
      { status: 500 }
    );
  }
} 