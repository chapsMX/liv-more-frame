import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { google } from 'googleapis';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');

    if (!user_fid) {
      return NextResponse.json({ error: 'user_fid es requerido' }, { status: 400 });
    }

    // Obtener los tokens del usuario
    const connection = await sql`
      SELECT google_token, refresh_token, token_expiry 
      FROM user_connections 
      WHERE user_fid = ${user_fid} AND provider = 'google'
    `;

    if (!connection[0]) {
      return NextResponse.json({ error: 'Usuario no conectado a Google Fit' }, { status: 404 });
    }

    const { google_token, refresh_token, token_expiry } = connection[0];

    // Configurar el cliente OAuth2
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: google_token,
      refresh_token: refresh_token,
      expiry_date: token_expiry
    });

    // Crear cliente de Google Fit
    const fitness = google.fitness('v1');

    // Obtener la fecha actual
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // Obtener datos de actividad física
    const [stepsResponse, caloriesResponse, sleepResponse] = await Promise.all([
      fitness.users.dataSources.datasets.get({
        userId: 'me',
        dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps',
        datasetId: `${startOfDay.getTime() * 1000000}-${endOfDay.getTime() * 1000000}`
      }),
      fitness.users.dataSources.datasets.get({
        userId: 'me',
        dataSourceId: 'derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended',
        datasetId: `${startOfDay.getTime() * 1000000}-${endOfDay.getTime() * 1000000}`
      }),
      fitness.users.sessions.list({
        userId: 'me',
        startTime: startOfDay.toISOString(),
        endTime: endOfDay.toISOString(),
        activityType: [72] // 72 es el tipo para sueño
      })
    ]);

    // Procesar los datos
    const steps = stepsResponse.data.point?.[0]?.value?.[0]?.intVal || 0;
    const calories = Math.round(caloriesResponse.data.point?.[0]?.value?.[0]?.fpVal || 0);
    const sleepHours = sleepResponse.data.session?.[0] 
      ? (new Date(Number(sleepResponse.data.session[0].endTimeMillis || 0)).getTime() - 
         new Date(Number(sleepResponse.data.session[0].startTimeMillis || 0)).getTime()) / (1000 * 60 * 60)
      : 0;

    // Actualizar daily_activities
    await sql`
      INSERT INTO daily_activities (user_fid, date, steps, calories, sleep_hours)
      VALUES (${user_fid}, ${now.toISOString().split('T')[0]}, ${steps}, ${calories}, ${sleepHours})
      ON CONFLICT (user_fid, date) 
      DO UPDATE SET 
        steps = ${steps},
        calories = ${calories},
        sleep_hours = ${sleepHours},
        updated_at = NOW()
    `;

    return NextResponse.json({
      steps,
      calories,
      sleepHours: Math.round(sleepHours * 10) / 10 // Redondear a 1 decimal
    });

  } catch (error) {
    console.error('Error al obtener datos de Google Fit:', error);
    return NextResponse.json(
      { error: 'Error al obtener datos de Google Fit' },
      { status: 500 }
    );
  }
} 