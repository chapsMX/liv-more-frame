import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { validateGoals } from '@/constants/goals';

export async function GET(request: Request) {
  try {
    console.log('🎯 Iniciando verificación de objetivos del usuario');
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    console.log('📋 FID recibido:', fid);

    if (!fid) {
      console.warn('⚠️ Error: FID no proporcionado en la solicitud');
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL!);
    
    console.log('🔄 Consultando objetivos del usuario...');
    const result = await sql`
      SELECT 
        calories_goal,
        steps_goal,
        sleep_hours_goal
      FROM user_goals 
      WHERE user_fid = ${fid}
    `;

    if (result.length === 0) {
      console.log('ℹ️ Usuario no tiene objetivos configurados');
      return NextResponse.json({
        hasGoals: false
      });
    }

    const goals = {
      calories: result[0].calories_goal,
      steps: result[0].steps_goal,
      sleep: result[0].sleep_hours_goal
    };
    
    const validation = validateGoals(goals);
    console.log('✅ Objetivos del usuario recuperados y validados:', { goals, validation });

    return NextResponse.json({
      hasGoals: true,
      goals,
      validation
    });

  } catch (error) {
    console.error('❌ Error verificando objetivos del usuario:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 