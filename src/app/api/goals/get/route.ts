import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const userFid = request.headers.get('x-user-fid');
    if (!userFid) {
      return NextResponse.json({ 
        success: false, 
        error: 'Usuario no autenticado' 
      }, { status: 401 });
    }

    // Obtener los objetivos del usuario
    const goals = await sql`
      SELECT 
        steps_goal,
        calories_goal,
        sleep_goal
      FROM user_connections 
      WHERE user_fid = ${parseInt(userFid)}
    `;

    if (goals.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Usuario no encontrado' 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        steps: goals[0].steps_goal,
        calories: goals[0].calories_goal,
        sleep: goals[0].sleep_goal
      }
    });

  } catch (error) {
    console.error('Error al obtener objetivos:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error al obtener los objetivos',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
} 