import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { OAuth2Client } from 'google-auth-library';

const sql = neon(process.env.DATABASE_URL!);

interface GoogleFitSession {
  startTimeMillis: string;
  endTimeMillis: string;
  activityType: number;
}

interface GoogleFitSleepData {
  session?: GoogleFitSession[];
}

interface GoogleFitBucket {
  dataset: Array<{
    point: Array<{
      value: Array<{
        fpVal?: number;
        intVal?: number;
      }>;
    }>;
  }>;
}

interface GoogleFitResponse {
  bucket?: GoogleFitBucket[];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');

    if (!user_fid) {
      return NextResponse.json({ error: 'user_fid is required' }, { status: 400 });
    }

    // 1. Obtener los tokens de Google del usuario
    const tokensResult = await sql`
      SELECT google_token as access_token, refresh_token, token_expiry
      FROM user_connections 
      WHERE user_fid = ${user_fid} AND provider = 'google'
    `;

    if (tokensResult.length === 0) {
      return NextResponse.json({ error: 'User not connected to Google Fit' }, { status: 401 });
    }

    const { access_token, refresh_token, token_expiry } = tokensResult[0];

    // Verificar si el token ha expirado
    if (new Date(token_expiry) < new Date()) {
      // Aquí deberíamos implementar la lógica para refrescar el token
      return NextResponse.json({ error: 'Token expired' }, { status: 401 });
    }

    // 2. Crear cliente OAuth2
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token,
      refresh_token
    });

    // 3. Obtener datos de actividad para hoy
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // 3.1 Obtener calorías
    const caloriesResponse = await fetch(
      `https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          aggregateBy: [{
            dataTypeName: 'com.google.calories.expended',
            dataSourceId: 'derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended'
          }],
          bucketByTime: { durationMillis: 86400000 },
          startTimeMillis: startOfDay.getTime(),
          endTimeMillis: endOfDay.getTime()
        })
      }
    );

    const caloriesData: GoogleFitResponse = await caloriesResponse.json();
    const calories = caloriesData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal || 0;

    // 3.2 Obtener pasos
    const stepsResponse = await fetch(
      `https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          aggregateBy: [{
            dataTypeName: 'com.google.step_count.delta',
            dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps'
          }],
          bucketByTime: { durationMillis: 86400000 },
          startTimeMillis: startOfDay.getTime(),
          endTimeMillis: endOfDay.getTime()
        })
      }
    );

    const stepsData: GoogleFitResponse = await stepsResponse.json();
    const steps = stepsData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;

    // 3.3 Obtener horas de sueño
    const sleepResponse = await fetch(
      `https://www.googleapis.com/fitness/v1/users/me/sessions`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const sleepData: GoogleFitSleepData = await sleepResponse.json();
    const todaySleep = sleepData.session?.filter((session: GoogleFitSession) => {
      const startTime = new Date(Number(session.startTimeMillis));
      return startTime >= startOfDay && startTime < endOfDay && 
             session.activityType === 72; // 72 es el tipo de actividad para dormir
    });

    const sleepHours = todaySleep?.reduce((total: number, session: GoogleFitSession) => {
      const duration = (Number(session.endTimeMillis) - Number(session.startTimeMillis)) / (1000 * 60 * 60);
      return total + duration;
    }, 0) || 0;

    return NextResponse.json({
      success: true,
      activity: {
        calories,
        steps,
        sleepHours
      }
    });
  } catch (error) {
    console.error('Error fetching activity data:', error);
    return NextResponse.json({ 
      error: 'Error fetching activity data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 