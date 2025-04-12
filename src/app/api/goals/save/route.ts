import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const { user_fid, calories_goal, steps_goal, sleep_hours_goal } = await request.json();

    if (!user_fid || !calories_goal || !steps_goal || !sleep_hours_goal) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    // Primero verificamos si ya existe un registro para este usuario
    const existingGoals = await sql`
      SELECT id FROM user_goals WHERE user_fid = ${user_fid}
    `;

    if (existingGoals.length > 0) {
      // Actualizamos los objetivos existentes
      await sql`
        UPDATE user_goals
        SET calories_goal = ${calories_goal},
            steps_goal = ${steps_goal},
            sleep_hours_goal = ${sleep_hours_goal},
            updated_at = NOW()
        WHERE user_fid = ${user_fid}
      `;
    } else {
      // Creamos nuevos objetivos
      await sql`
        INSERT INTO user_goals (user_fid, calories_goal, steps_goal, sleep_hours_goal)
        VALUES (${user_fid}, ${calories_goal}, ${steps_goal}, ${sleep_hours_goal})
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving user goals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 