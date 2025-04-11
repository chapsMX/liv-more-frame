import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { fitness_v1 } from 'googleapis';

const sql = neon(process.env.DATABASE_URL!);

interface FitnessData {
  bucket?: Array<{
    dataset?: Array<{
      point?: Array<{
        value?: Array<{
          intVal?: number;
          fpVal?: number;
        }>;
        startTimeNanos?: string;
        endTimeNanos?: string;
      }>;
    }>;
  }>;
}

export async function GET(request: Request) {
  try {
    const userFid = request.headers.get('x-user-fid');
    if (!userFid) {
      return NextResponse.json({ 
        success: false, 
        error: 'Usuario no autenticado' 
      }, { status: 401 });
    }

    // Obtener la conexión del usuario
    const connection = await sql`
      SELECT google_token, token_expiry, provider, refresh_token
      FROM user_connections 
      WHERE user_fid = ${parseInt(userFid)}
    `;

    if (connection.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Usuario no tiene conexión con Google Fit' 
      }, { status: 404 });
    }

    // Configurar cliente de Google
    const oauth2Client = new OAuth2Client({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI
    });

    oauth2Client.setCredentials({
      access_token: connection[0].google_token,
      refresh_token: connection[0].refresh_token,
      expiry_date: connection[0].token_expiry?.getTime()
    });

    // Verificar si el token ha expirado y refrescarlo si es necesario
    if (connection[0].token_expiry && connection[0].token_expiry.getTime() < Date.now()) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
      
      // Actualizar el token en la base de datos
      await sql`
        UPDATE user_connections 
        SET google_token = ${credentials.access_token},
            token_expiry = ${new Date(credentials.expiry_date!)}
        WHERE user_fid = ${parseInt(userFid)}
      `;
    }

    const fitness = google.fitness({
      version: 'v1',
      auth: oauth2Client
    });

    // Obtener el rango de fechas (últimas 24 horas)
    const endTime = new Date();
    const startTime = new Date(endTime);
    startTime.setHours(0, 0, 0, 0);

    // Obtener datos de pasos y calorías en una sola llamada
    const activityResponse = await fitness.users.dataset.aggregate({
      userId: 'me',
      requestBody: {
        aggregateBy: [
          {
            dataTypeName: 'com.google.step_count.delta'
          },
          {
            dataTypeName: 'com.google.calories.expended'
          }
        ],
        bucketByTime: { durationMillis: '86400000' }, // 24 horas
        startTimeMillis: startTime.getTime().toString(),
        endTimeMillis: endTime.getTime().toString()
      }
    });

    // Obtener datos de sueño usando el endpoint de sesiones
    const sleepResponse = await fitness.users.sessions.list({
      userId: 'me',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      activityType: [72] // Sleep
    });

    console.log('Respuesta de actividad:', activityResponse.data);
    console.log('Respuesta de sueño:', sleepResponse.data);

    // Procesar datos de pasos y calorías
    const activityData = activityResponse.data as unknown as FitnessData;
    const steps = activityData.bucket?.[0]?.dataset?.[0]?.point?.reduce((acc, point) => {
      return acc + (point.value?.[0]?.intVal || 0);
    }, 0) || 0;

    const calories = activityData.bucket?.[0]?.dataset?.[1]?.point?.reduce((acc, point) => {
      return acc + (point.value?.[0]?.fpVal || 0);
    }, 0) || 0;

    // Procesar datos de sueño
    const sleepSessions = (sleepResponse.data as fitness_v1.Schema$ListSessionsResponse).session || [];
    const sleepMinutes = sleepSessions.reduce((acc: number, session: fitness_v1.Schema$Session) => {
      const start = new Date(parseInt(session.startTimeMillis || '0'));
      const end = new Date(parseInt(session.endTimeMillis || '0'));
      return acc + (end.getTime() - start.getTime()) / (1000 * 60);
    }, 0);

    // Guardar los datos en daily_activities
    await sql`
      INSERT INTO daily_activities (
        user_fid,
        date,
        steps,
        calories,
        sleep_hours,
        steps_completed,
        calories_completed,
        sleep_completed,
        all_completed
      ) VALUES (
        ${parseInt(userFid)},
        ${new Date().toISOString().split('T')[0]},
        ${steps},
        ${Math.round(calories)},
        ${Math.round(sleepMinutes / 60 * 10) / 10},
        ${steps >= 10000},
        ${calories >= 2500},
        ${sleepMinutes >= 8 * 60},
        ${steps >= 10000 && calories >= 2500 && sleepMinutes >= 8 * 60}
      )
      ON CONFLICT (user_fid, date) DO UPDATE SET
        steps = EXCLUDED.steps,
        calories = EXCLUDED.calories,
        sleep_hours = EXCLUDED.sleep_hours,
        steps_completed = EXCLUDED.steps_completed,
        calories_completed = EXCLUDED.calories_completed,
        sleep_completed = EXCLUDED.sleep_completed,
        all_completed = EXCLUDED.all_completed,
        updated_at = CURRENT_TIMESTAMP
    `;

    return NextResponse.json({
      success: true,
      data: {
        steps,
        calories: Math.round(calories),
        sleep: Math.round(sleepMinutes / 60 * 10) / 10 // Convertir a horas con un decimal
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error al obtener datos de fitness',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
} 