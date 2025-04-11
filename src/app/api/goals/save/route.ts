import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const userFid = request.headers.get('x-user-fid');
    if (!userFid) {
      return NextResponse.json({ 
        success: false, 
        error: 'Usuario no autenticado' 
      }, { status: 401 });
    }

    const { steps, calories, sleep } = await request.json();

    // Validar los datos
    if (!steps || !calories || !sleep) {
      return NextResponse.json({ 
        success: false, 
        error: 'Faltan datos requeridos' 
      }, { status: 400 });
    }

    if (steps < 1000 || steps > 100000) {
      return NextResponse.json({ 
        success: false, 
        error: 'El objetivo de pasos debe estar entre 1,000 y 100,000' 
      }, { status: 400 });
    }

    if (calories < 500 || calories > 10000) {
      return NextResponse.json({ 
        success: false, 
        error: 'El objetivo de calorías debe estar entre 500 y 10,000' 
      }, { status: 400 });
    }

    if (sleep < 4 || sleep > 12) {
      return NextResponse.json({ 
        success: false, 
        error: 'El objetivo de sueño debe estar entre 4 y 12 horas' 
      }, { status: 400 });
    }

    // Guardar los objetivos en la tabla user_goals
    await sql`
      INSERT INTO user_goals (
        user_fid,
        steps_goal,
        calories_goal,
        sleep_hours_goal,
        updated_at
      ) VALUES (
        ${parseInt(userFid)},
        ${steps},
        ${calories},
        ${sleep},
        ${new Date()}
      )
      ON CONFLICT (user_fid) 
      DO UPDATE SET 
        steps_goal = EXCLUDED.steps_goal,
        calories_goal = EXCLUDED.calories_goal,
        sleep_hours_goal = EXCLUDED.sleep_hours_goal,
        updated_at = EXCLUDED.updated_at
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al guardar objetivos:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error al guardar los objetivos',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
} 