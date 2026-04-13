import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const metric = searchParams.get('metric') || 'steps'; // 'steps' or 'calories'
    const limit = parseInt(searchParams.get('limit') || '50'); // Default top 50

    if (!['steps', 'calories'].includes(metric)) {
      return NextResponse.json(
        { error: 'Invalid metric. Must be "steps" or "calories"' },
        { status: 400 }
      );
    }

    // Get top users by single-day maximum activity
    let result;
    
    if (metric === 'steps') {
      result = await sql`
        SELECT 
          da.user_fid,
          u.username,
          u.display_name,
          MAX(da.steps) as max_steps,
          COUNT(da.date) as active_days,
          (SELECT date FROM daily_activities WHERE user_fid = da.user_fid AND steps = MAX(da.steps) LIMIT 1) as max_date
        FROM daily_activities da
        JOIN livmore u ON da.user_fid = u.user_fid
        WHERE da.steps > 0
        GROUP BY da.user_fid, u.username, u.display_name
        HAVING MAX(da.steps) > 0
        ORDER BY max_steps DESC
        LIMIT ${limit}
      `;
    } else {
      result = await sql`
        SELECT 
          da.user_fid,
          u.username,
          u.display_name,
          MAX(da.calories) as max_calories,
          COUNT(da.date) as active_days,
          (SELECT date FROM daily_activities WHERE user_fid = da.user_fid AND calories = MAX(da.calories) LIMIT 1) as max_date
        FROM daily_activities da
        JOIN livmore u ON da.user_fid = u.user_fid
        WHERE da.calories > 0
        GROUP BY da.user_fid, u.username, u.display_name
        HAVING MAX(da.calories) > 0
        ORDER BY max_calories DESC
        LIMIT ${limit}
      `;
    }
    
    const leaderboard = result.map((row, index: number) => ({
      rank: index + 1,
      user_fid: row.user_fid,
      username: row.username,
      display_name: row.display_name,
      total: parseInt(row[`max_${metric}`]),
      active_days: parseInt(row.active_days),
      max_date: row.max_date,
      metric: metric
    }));

    return NextResponse.json({
      leaderboard,
      metric,
      total_users: leaderboard.length
    });

  } catch (error) {
    console.error('❌ Error fetching top leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top leaderboard' },
      { status: 500 }
    );
  }
} 