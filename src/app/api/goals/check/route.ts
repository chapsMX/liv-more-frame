import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userFid = searchParams.get('user_fid');

    if (!userFid) {
      return NextResponse.json({
        success: false,
        error: 'Missing user_fid parameter'
      }, { status: 400 });
    }

    // Check if user has goals set
    const goals = await sql`
      SELECT id, steps_goal, calories_goal, sleep_hours_goal 
      FROM user_goals 
      WHERE user_fid = ${parseInt(userFid)}
    `;

    return NextResponse.json({
      success: true,
      hasGoals: goals.length > 0,
      goals: goals.length > 0 ? {
        steps: goals[0].steps_goal,
        calories: goals[0].calories_goal,
        sleep: goals[0].sleep_hours_goal
      } : null
    });

  } catch (error) {
    console.error('Error checking goals:', error);
    return NextResponse.json({
      success: false,
      error: 'Error checking goals',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 