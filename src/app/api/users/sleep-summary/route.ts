import { NextResponse } from 'next/server';

const ROOK_API_URL = 'https://api.rook-connect.review';
const ROOK_CLIENT_UUID = process.env.ROOK_CLIENT_UUID!;
const ROOK_CLIENT_SECRET = process.env.ROOK_CLIENT_SECRET!;

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

    // Validar que la fecha no sea futura
    const requestDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (requestDate > today) {
      console.log('⚠️ Fecha futura solicitada:', date);
      return NextResponse.json({
        sleep_duration_hours: 0,
        message: 'Future date requested'
      });
    }

    console.log('🔍 Obteniendo resumen de sueño para:', { user_id, date });

    // Crear el Basic Auth token
    const authToken = Buffer.from(`${ROOK_CLIENT_UUID}:${ROOK_CLIENT_SECRET}`).toString('base64');

    // Llamar a la API de Rook
    const response = await fetch(
      `${ROOK_API_URL}/v2/processed_data/sleep_health/summary?user_id=${user_id}&date=${date}`,
      {
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📡 Respuesta de Rook:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    // Manejar 204 No Content
    if (response.status === 204) {
      console.log('ℹ️ No hay datos de sueño disponibles para la fecha especificada');
      return NextResponse.json({
        sleep_duration_hours: 0,
        message: 'No data available for the specified date'
      });
    }

    // Manejar otros errores
    if (!response.ok) {
      console.error('❌ Error obteniendo resumen de sueño:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Error fetching sleep summary' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Resumen de sueño obtenido:', data);

    // Extraer los datos relevantes y convertir de segundos a horas
    const sleepDurationSeconds = data.sleep_health?.summary?.sleep_summary?.duration?.sleep_duration_seconds_int || 0;
    const sleepDurationHours = Math.round((sleepDurationSeconds / 3600) * 10) / 10; // Redondear a 1 decimal

    return NextResponse.json({
      sleep_duration_hours: sleepDurationHours
    });

  } catch (error) {
    console.error('❌ Error en obtención de resumen de sueño:', error);
    return NextResponse.json(
      { error: 'Error fetching sleep summary' },
      { status: 500 }
    );
  }
}
