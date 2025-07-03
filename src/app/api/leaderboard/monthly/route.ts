import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const metric = searchParams.get('metric') || 'steps'; // 'steps' or 'calories'
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString()); // 1-12
    const limit = parseInt(searchParams.get('limit') || '50'); // Default top 50

    if (!['steps', 'calories'].includes(metric)) {
      return NextResponse.json(
        { error: 'Invalid metric. Must be "steps" or "calories"' },
        { status: 400 }
      );
    }

    if (month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Invalid month. Must be between 1 and 12' },
        { status: 400 }
      );
    }

    // ✅ CORRECTED: Get monthly leaderboard using whitelist_users instead of livmore
    let result;
    
    if (metric === 'steps') {
      result = await sql`
        SELECT 
          da.user_fid,
          u.username,
          u.display_name,
          SUM(da.steps) as monthly_steps,
          COUNT(da.activity_date) as active_days_in_month,
          AVG(da.steps) as avg_daily_steps
        FROM v2_daily_activities da
        JOIN whitelist_users u ON da.user_fid = u.user_fid
        WHERE 
          EXTRACT(YEAR FROM da.activity_date) = ${year}
          AND EXTRACT(MONTH FROM da.activity_date) = ${month}
          AND da.steps > 0
        GROUP BY da.user_fid, u.username, u.display_name
        HAVING SUM(da.steps) > 0
        ORDER BY monthly_steps DESC
        LIMIT ${limit}
      `;
    } else {
      result = await sql`
        SELECT 
          da.user_fid,
          u.username,
          u.display_name,
          SUM(da.calories) as monthly_calories,
          COUNT(da.activity_date) as active_days_in_month,
          AVG(da.calories) as avg_daily_calories
        FROM v2_daily_activities da
        JOIN whitelist_users u ON da.user_fid = u.user_fid
        WHERE 
          EXTRACT(YEAR FROM da.activity_date) = ${year}
          AND EXTRACT(MONTH FROM da.activity_date) = ${month}
          AND da.calories > 0
        GROUP BY da.user_fid, u.username, u.display_name
        HAVING SUM(da.calories) > 0
        ORDER BY monthly_calories DESC
        LIMIT ${limit}
      `;
    }
    
    const leaderboard = result.map((row, index: number) => ({
      rank: index + 1,
      user_fid: row.user_fid,
      username: row.username,
      display_name: row.display_name,
      monthly_total: parseInt(row[`monthly_${metric}`]),
      active_days_in_month: parseInt(row.active_days_in_month),
      daily_average: Math.round(parseFloat(row[`avg_daily_${metric}`])),
      metric: metric
    }));

    // Get month name for display
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return NextResponse.json({
      leaderboard,
      metric,
      year,
      month,
      month_name: monthNames[month - 1],
      total_users: leaderboard.length,
      data_source: 'v2_daily_activities + whitelist_users' // ✅ UPDATED: Indicar tabla corregida
    });

  } catch (error) {
    console.error('❌ Error fetching monthly leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly leaderboard' },
      { status: 500 }
    );
  }
} 