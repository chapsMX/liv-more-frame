import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');

    if (!user_fid) {
      return NextResponse.json({ error: 'user_fid is required' }, { status: 400 });
    }

    const result = await sql`
      SELECT calories_goal, steps_goal, sleep_hours_goal
      FROM user_goals
      WHERE user_fid = ${user_fid}
    `;

    if (result.length === 0) {
      return NextResponse.json({ hasGoals: false });
    }

    return NextResponse.json({
      hasGoals: true,
      goals: {
        calories_goal: result[0].calories_goal,
        steps_goal: result[0].steps_goal,
        sleep_hours_goal: result[0].sleep_hours_goal
      }
    });
  } catch (error) {
    console.error('Error checking user goals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 