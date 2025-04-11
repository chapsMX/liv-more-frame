import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

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
      SELECT google_token, token_expiry, provider
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
      expiry_date: connection[0].token_expiry?.getTime()
    });

    const fitness = google.fitness({
      version: 'v1',
      auth: oauth2Client
    });

    // Obtener el rango de fechas (últimas 24 horas)
    const endTime = new Date();
    const startTime = new Date(endTime);
    startTime.setHours(0, 0, 0, 0);

    // Obtener datos de pasos
    const stepsResponse = await fitness.users.dataset.aggregate({
      requestBody: {
        aggregateBy: [{
          dataTypeName: 'com.google.step_count.delta'
        }],
        bucketByTime: { durationMillis: 86400000 }, // 24 horas
        startTimeMillis: startTime.getTime(),
        endTimeMillis: endTime.getTime()
      }
    });

    // Obtener datos de calorías
    const caloriesResponse = await fitness.users.dataset.aggregate({
      requestBody: {
        aggregateBy: [{
          dataTypeName: 'com.google.calories.expended'
        }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: startTime.getTime(),
        endTimeMillis: endTime.getTime()
      }
    });

    // Obtener datos de sueño
    const sleepResponse = await fitness.users.dataset.aggregate({
      requestBody: {
        aggregateBy: [{
          dataTypeName: 'com.google.sleep.segment'
        }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: startTime.getTime(),
        endTimeMillis: endTime.getTime()
      }
    });

    // Procesar y devolver los datos
    const stepsData = stepsResponse.data as unknown as FitnessData;
    const caloriesData = caloriesResponse.data as unknown as FitnessData;
    const sleepData = sleepResponse.data as unknown as FitnessData;

    const steps = stepsData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
    const calories = Math.round(caloriesData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal || 0);
    const sleepMinutes = sleepData.bucket?.[0]?.dataset?.[0]?.point?.reduce((acc: number, point) => {
      return acc + (parseInt(point.endTimeNanos!) - parseInt(point.startTimeNanos!)) / 60000000000;
    }, 0) || 0;

    return NextResponse.json({
      success: true,
      data: {
        steps,
        calories,
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