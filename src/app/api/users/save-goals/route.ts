import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function POST(request: Request) {
  try {
    console.log('🎯 Iniciando guardado de objetivos del usuario');
    const sql = neon(process.env.DATABASE_URL!);
    const { user_fid, calories, steps, sleep } = await request.json();

    console.log('📋 Datos recibidos:', {
      user_fid,
      calories,
      steps,
      sleep
    });

    if (!user_fid) {
      console.warn('⚠️ Error: FID no proporcionado');
      return NextResponse.json({ success: false, error: 'User FID is required' }, { status: 400 });
    }

    console.log('🔄 Guardando objetivos en user_goals...');
    const result = await sql`
      INSERT INTO user_goals (
        user_fid,
        calories_goal,
        steps_goal,
        sleep_hours_goal,
        updated_at
      ) VALUES (
        ${user_fid},
        ${calories},
        ${steps},
        ${sleep},
        NOW()
      )
      ON CONFLICT (user_fid)
      DO UPDATE SET
        calories_goal = ${calories},
        steps_goal = ${steps},
        sleep_hours_goal = ${sleep},
        updated_at = NOW()
      RETURNING *
    `;

    console.log('✅ Objetivos guardados exitosamente:', result[0]);
    return NextResponse.json({ 
      success: true, 
      goals: result[0]
    });
  } catch (error) {
    console.error('❌ Error guardando objetivos del usuario:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 