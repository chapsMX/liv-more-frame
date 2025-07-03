import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userFid = searchParams.get('user_fid');
    const targetDate = searchParams.get('date'); // ✅ NEW: Permitir fecha específica

    if (!userFid) {
      return NextResponse.json(
        { error: 'user_fid is required' },
        { status: 400 }
      );
    }

    console.log('🔍 [Health Data V2] Obteniendo datos optimizados para usuario:', userFid);

    // Obtener timezone del usuario para calcular fechas correctamente
    const userTimezoneData = await sql`
      SELECT timezone FROM user_goals WHERE user_fid = ${userFid} LIMIT 1
    `;
    
    const userTimezone = userTimezoneData[0]?.timezone || 'UTC';
    
    // ✅ CHANGED: Calcular "yesterday" por defecto en lugar de "today"
    const now = new Date();
    let userTargetDate: string;
    
    if (targetDate) {
      // Si se especifica una fecha, usarla
      userTargetDate = targetDate;
      console.log('🗓️ [Health Data V2] Usando fecha específica:', userTargetDate);
    } else {
      // Por defecto, usar AYER en el timezone del usuario
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      
      userTargetDate = new Intl.DateTimeFormat('en-CA', { 
        timeZone: userTimezone 
      }).format(yesterday);
      
      console.log('🕐 [Health Data V2] Timezone del usuario:', userTimezone);
      console.log('🗓️ [Health Data V2] Fecha objetivo (AYER):', userTargetDate);
    }

    // ✅ UPDATED: Obtener datos del día objetivo desde v2_daily_activities
    const targetDayData = await sql`
      SELECT 
        activity_date,
        steps,
        calories,
        sleep_hours,
        steps_completed,
        calories_completed,
        sleep_completed,
        all_completed,
        data_source,
        processing_date
      FROM v2_daily_activities 
      WHERE user_fid = ${userFid} AND activity_date = ${userTargetDate}
      ORDER BY processing_date DESC
      LIMIT 1
    `;

    // ✅ CORRECTED: Obtener datos de la semana PREVIA al día objetivo (excluyendo el día objetivo)
    const weeklyData = await sql`
      SELECT 
        activity_date,
        steps,
        calories,
        sleep_hours,
        steps_completed,
        calories_completed,
        sleep_completed,
        all_completed,
        data_source
      FROM v2_daily_activities 
      WHERE user_fid = ${userFid} 
        AND activity_date < ${userTargetDate}::date
        AND activity_date >= ${userTargetDate}::date - INTERVAL '7 days'
      ORDER BY activity_date ASC
    `;

    // Obtener objetivos del usuario
    const userGoals = await sql`
      SELECT 
        steps_goal,
        calories_goal,
        sleep_hours_goal
      FROM user_goals 
      WHERE user_fid = ${userFid}
      LIMIT 1
    `;

    // ✅ UPDATED: Procesar datos del día objetivo (ayer por defecto)
    const dailyMetrics = targetDayData[0] || {
      steps: 0,
      calories: 0,
      sleep_hours: 0,
      steps_completed: false,
      calories_completed: false,
      sleep_completed: false,
      all_completed: false
    };

    // Procesar datos semanales y calcular porcentajes
    const goals = userGoals[0] || { steps_goal: 10000, calories_goal: 2000, sleep_hours_goal: 8 };
    
    // Crear array de 7 días (incluyendo días sin datos)
    const weeklyMetrics: {
      calories: { value: number; percentage: number }[];
      steps: { value: number; percentage: number }[];
      sleep: { value: number; percentage: number }[];
    } = {
      calories: [],
      steps: [],
      sleep: []
    };

    // ✅ CORRECTED: Llenar los 7 días PREVIOS al día objetivo (excluyendo el día objetivo)
    for (let i = 7; i >= 1; i--) {
      const targetDateObj = new Date(userTargetDate);
      targetDateObj.setDate(targetDateObj.getDate() - i);
      const dateStr = new Intl.DateTimeFormat('en-CA', { 
        timeZone: userTimezone 
      }).format(targetDateObj);

      // Buscar por activity_date en lugar de date
      const dayData = weeklyData.find(d => 
        new Date(d.activity_date).toISOString().split('T')[0] === dateStr
      ) || { steps: 0, calories: 0, sleep_hours: 0 };

      // Calcular porcentajes
      const caloriesPercentage = Math.min((dayData.calories / goals.calories_goal) * 100, 100);
      const stepsPercentage = Math.min((dayData.steps / goals.steps_goal) * 100, 100);
      const sleepPercentage = Math.min((dayData.sleep_hours / goals.sleep_hours_goal) * 100, 100);

      weeklyMetrics.calories.push({ 
        value: dayData.calories || 0,
        percentage: caloriesPercentage || 0
      });
      weeklyMetrics.steps.push({ 
        value: dayData.steps || 0,
        percentage: stepsPercentage || 0
      });
      weeklyMetrics.sleep.push({ 
        value: dayData.sleep_hours || 0,
        percentage: sleepPercentage || 0
      });
    }

    const response = {
      success: true,
      user_fid: userFid,
      table_version: 'v2_daily_activities',
      target_date: userTargetDate, // ✅ NEW: Indicar qué fecha se está mostrando
      date_type: targetDate ? 'specific' : 'yesterday', // ✅ NEW: Indicar tipo de fecha
      daily_metrics: {
        steps: dailyMetrics.steps || 0,
        calories: dailyMetrics.calories || 0,
        sleep: dailyMetrics.sleep_hours || 0
      },
      weekly_metrics: weeklyMetrics,
      user_goals: {
        steps_goal: goals.steps_goal,
        calories_goal: goals.calories_goal,
        sleep_hours_goal: goals.sleep_hours_goal
      },
      completion_status: {
        steps_completed: dailyMetrics.steps_completed || false,
        calories_completed: dailyMetrics.calories_completed || false,
        sleep_completed: dailyMetrics.sleep_completed || false,
        all_completed: dailyMetrics.all_completed || false
      },
      data_quality: {
        data_source: targetDayData[0]?.data_source || null,
        processing_date: targetDayData[0]?.processing_date || null,
        has_target_date_data: targetDayData.length > 0,
        weekly_days_with_data: weeklyData.length
      }
    };

    console.log('✅ [Health Data V2] Datos optimizados obtenidos exitosamente desde v2_daily_activities (AYER por defecto)');
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ [Health Data V2] Error obteniendo datos:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error obteniendo datos de salud',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 