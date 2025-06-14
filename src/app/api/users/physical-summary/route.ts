import { NextResponse } from 'next/server';

const ROOK_API_URL = 'https://api.rook-connect.review';
const ROOK_CLIENT_UUID = process.env.ROOK_CLIENT_UUID!;
const ROOK_CLIENT_SECRET = process.env.ROOK_CLIENT_SECRET!;

interface ActivityDuration {
  duration_seconds_int: number;
}

interface ActivityEvent {
  duration?: ActivityDuration;
}

interface PhysicalHealthEvents {
  activity: ActivityEvent[];
}

interface ActivityResponse {
  physical_health?: {
    events?: PhysicalHealthEvents;
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');
    const date = searchParams.get('date');

    if (!user_id || !date) {
      return NextResponse.json(
        { error: 'Missing user_id or date' },
        { status: 400 }
      );
    }

// Obtener la fecha de hoy en UTC sin horas
const todayUTC = new Date();
todayUTC.setUTCHours(0, 0, 0, 0);

// Obtener la fecha solicitada como UTC también
const requestedUTC = new Date(`${date}T00:00:00Z`);

if (requestedUTC.getTime() > todayUTC.getTime()) {
  console.log('⚠️ Fecha futura solicitada (UTC):', date);
  return NextResponse.json({
    steps: 0,
    calories: 0,
    distance_meters: 0,
    active_seconds: 0,
    message: 'Future date requested'
  });
}

    console.log('🔍 Obteniendo resumen físico para:', { user_id, date });

    // Crear el Basic Auth token
    const authToken = Buffer.from(`${ROOK_CLIENT_UUID}:${ROOK_CLIENT_SECRET}`).toString('base64');

    // Obtener datos del resumen físico
    const summaryResponse = await fetch(
      `${ROOK_API_URL}/v2/processed_data/physical_health/summary?user_id=${user_id}&date=${date}`,
      {
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Respuesta de resumen físico:', {
      status: summaryResponse.status,
      statusText: summaryResponse.statusText,
      headers: Object.fromEntries(summaryResponse.headers.entries())
    });

    // Obtener datos de actividad
    const activityResponse = await fetch(
      `${ROOK_API_URL}/v2/processed_data/physical_health/events/activity?user_id=${user_id}&date=${date}`,
      {
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Respuesta de actividad fìsica:', {
      status: activityResponse.status,
      statusText: activityResponse.statusText,
      headers: Object.fromEntries(activityResponse.headers.entries())
    });

    // Manejar 204 No Content para resumen físico
    if (summaryResponse.status === 204) {
      console.log('ℹ️ No hay datos de resumen físico disponibles para la fecha especificada');
      return NextResponse.json({
        steps: 0,
        calories: 0,
        distance_meters: 0,
        active_seconds: 0,
        message: 'No data available for the specified date'
      });
    }

    // Manejar otros errores
    if (!summaryResponse.ok) {
      console.error('❌ Error obteniendo resumen físico:', summaryResponse.status, summaryResponse.statusText);
      return NextResponse.json(
        { error: 'Error fetching physical summary' },
        { status: summaryResponse.status }
      );
    }

    const summaryData = await summaryResponse.json();
    console.log('✅ Resumen físico obtenido:', summaryData);

    // Extraer datos del resumen físico
    const physicalSummary = summaryData.physical_health?.summary?.physical_summary;
    const steps = physicalSummary?.distance?.steps_int || 0;
    const calories = physicalSummary?.calories?.calories_expenditure_kcal_float || 0;
    const distance = physicalSummary?.distance?.distance_meters_float || 0;

    // Procesar datos de actividad si están disponibles
    let activeSeconds = 0;
    if (activityResponse.ok && activityResponse.status !== 204) {
      const activityData = await activityResponse.json() as ActivityResponse;
      console.log('✅ Datos de actividad obtenidos:', activityData);

      // Sumar la duración de todas las actividades
      if (activityData.physical_health?.events?.activity) {
        activeSeconds = activityData.physical_health.events.activity.reduce((total: number, activity: ActivityEvent) => {
          return total + (activity.duration?.duration_seconds_int || 0);
        }, 0);
      }
    }

    return NextResponse.json({
      steps,
      calories,
      distance_meters: Math.round(distance),
      active_seconds: activeSeconds,
      has_activity_data: activityResponse.ok && activityResponse.status !== 204
    });

  } catch (error) {
    console.error('❌ Error en obtención de resumen físico:', error);
    return NextResponse.json(
      { error: 'Error fetching physical summary' },
      { status: 500 }
    );
  }
}
