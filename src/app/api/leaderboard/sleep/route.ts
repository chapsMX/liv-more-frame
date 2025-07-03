import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'monthly'; // 'monthly' or 'best_single_day'
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString()); // 1-12
    const limit = parseInt(searchParams.get('limit') || '50'); // Default top 50

    if (!['monthly', 'best_single_day'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "monthly" or "best_single_day"' },
        { status: 400 }
      );
    }

    if (month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Invalid month. Must be between 1 and 12' },
        { status: 400 }
      );
    }

    console.log('😴 [Sleep Leaderboard] Obteniendo leaderboard modo:', mode, 'para', year, '-', month);

    let result;
    
    if (mode === 'monthly') {
      // Monthly Average Sleep Leaderboard
      result = await sql`
        SELECT 
          da.user_fid,
          u.username,
          u.display_name,
          AVG(da.sleep_hours) as avg_sleep_hours,
          COUNT(da.activity_date) as sleep_days_in_month,
          SUM(CASE WHEN da.sleep_hours >= 7 THEN 1 ELSE 0 END) as good_sleep_days,
          MAX(da.sleep_hours) as best_sleep_in_month,
          MIN(da.sleep_hours) as worst_sleep_in_month
        FROM v2_daily_activities da
        JOIN whitelist_users u ON da.user_fid = u.user_fid
        WHERE 
          EXTRACT(YEAR FROM da.activity_date) = ${year}
          AND EXTRACT(MONTH FROM da.activity_date) = ${month}
          AND da.sleep_hours > 0
        GROUP BY da.user_fid, u.username, u.display_name
        HAVING AVG(da.sleep_hours) > 0 AND COUNT(da.activity_date) >= 3
        ORDER BY avg_sleep_hours DESC
        LIMIT ${limit}
      `;
    } else {
      // Best Single Day Sleep Leaderboard
      result = await sql`
        SELECT 
          da.user_fid,
          u.username,
          u.display_name,
          MAX(da.sleep_hours) as best_sleep,
          COUNT(da.activity_date) as total_sleep_days,
          AVG(da.sleep_hours) as avg_sleep,
          (SELECT activity_date FROM v2_daily_activities WHERE user_fid = da.user_fid AND sleep_hours = MAX(da.sleep_hours) LIMIT 1) as best_sleep_date
        FROM v2_daily_activities da
        JOIN whitelist_users u ON da.user_fid = u.user_fid
        WHERE da.sleep_hours > 0
        GROUP BY da.user_fid, u.username, u.display_name
        HAVING MAX(da.sleep_hours) > 0
        ORDER BY best_sleep DESC
        LIMIT ${limit}
      `;
    }
    
    let leaderboard;
    
    if (mode === 'monthly') {
      leaderboard = result.map((row, index: number) => ({
        rank: index + 1,
        user_fid: row.user_fid,
        username: row.username,
        display_name: row.display_name,
        avg_sleep_hours: Math.round(parseFloat(row.avg_sleep_hours) * 10) / 10, // Round to 1 decimal
        sleep_days_in_month: parseInt(row.sleep_days_in_month),
        good_sleep_days: parseInt(row.good_sleep_days), // Days with 7+ hours
        good_sleep_percentage: Math.round((parseInt(row.good_sleep_days) / parseInt(row.sleep_days_in_month)) * 100),
        best_sleep_in_month: Math.round(parseFloat(row.best_sleep_in_month) * 10) / 10,
        worst_sleep_in_month: Math.round(parseFloat(row.worst_sleep_in_month) * 10) / 10,
        consistency_score: Math.round((parseInt(row.good_sleep_days) / parseInt(row.sleep_days_in_month)) * 100),
        mode: 'monthly'
      }));
    } else {
      leaderboard = result.map((row, index: number) => ({
        rank: index + 1,
        user_fid: row.user_fid,
        username: row.username,
        display_name: row.display_name,
        best_sleep: Math.round(parseFloat(row.best_sleep) * 10) / 10,
        total_sleep_days: parseInt(row.total_sleep_days),
        avg_sleep: Math.round(parseFloat(row.avg_sleep) * 10) / 10,
        best_sleep_date: row.best_sleep_date,
        mode: 'best_single_day'
      }));
    }

    // Get month name for display
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const response = {
      leaderboard,
      mode,
      year,
      month,
      month_name: monthNames[month - 1],
      total_users: leaderboard.length,
      data_source: 'v2_daily_activities + whitelist_users',
      description: mode === 'monthly' ? 
        `Average sleep hours for ${monthNames[month - 1]} ${year} (min 3 days with data)` :
        'Best single day sleep records (all time)'
    };

    console.log('✅ [Sleep Leaderboard] Leaderboard generado exitosamente:', {
      mode,
      users: leaderboard.length,
      sample: leaderboard.slice(0, 2)
    });
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ [Sleep Leaderboard] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sleep leaderboard' },
      { status: 500 }
    );
  }
} 