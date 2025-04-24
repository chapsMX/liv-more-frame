import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { OAuth2Client } from 'google-auth-library';

const sql = neon(process.env.DATABASE_URL!);

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

interface GoogleFitSession {
  startTimeMillis: string;
  endTimeMillis: string;
  activityType: number;
}

interface GoogleFitSleepResponse {
  session?: GoogleFitSession[];
}

async function refreshToken() {
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  try {
    const response = await oauth2Client.refreshAccessToken();
    return response.credentials;
  } catch (error) {
    console.error('Error refreshing token:', error);
    throw error;
  }
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

    const { token_expiry } = tokensResult[0];
    let { access_token } = tokensResult[0];

    // Verificar si el token ha expirado
    if (new Date(token_expiry) < new Date()) {
      try {
        const newTokens = await refreshToken();
        
        // Actualizar tokens en la base de datos
        await sql`
          UPDATE user_connections
          SET google_token = ${newTokens.access_token},
              token_expiry = ${new Date(Date.now() + (newTokens.expiry_date || 3600) * 1000)}
          WHERE user_fid = ${user_fid} AND provider = 'google'
        `;

        access_token = newTokens.access_token!;
      } catch (error) {
        console.error('Error refreshing token:', error);
        return NextResponse.json({ error: 'Failed to refresh token' }, { status: 401 });
      }
    }

    // 2. Configurar fechas para los últimos 7 días
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: userTimezone }));
    
    // Configurar el fin del período (ayer a las 23:59:59.999)
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - 1);
    endDate.setHours(23, 59, 59, 999);
    
    // Configurar el inicio del período (7 días antes del fin)
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    // Convertir a UTC para la API de Google
    const startTimeMillis = startDate.getTime();
    const endTimeMillis = endDate.getTime();

    // 3. Obtener datos de los últimos 7 días
    const weeklyData = [];
    
    // 3.1 Obtener calorías de la semana
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
          bucketByTime: { durationMillis: 86400000 }, // Agrupar por día (24 horas)
          startTimeMillis: startTimeMillis,
          endTimeMillis: endTimeMillis
        })
      }
    );

    const caloriesData: GoogleFitResponse = await caloriesResponse.json();

    // 3.2 Obtener pasos de la semana
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
          bucketByTime: { durationMillis: 86400000 }, // Agrupar por día (24 horas)
          startTimeMillis: startTimeMillis,
          endTimeMillis: endTimeMillis
        })
      }
    );

    const stepsData: GoogleFitResponse = await stepsResponse.json();

    // 3.3 Obtener sueño de la semana
    const sleepResponse = await fetch(
      `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${startDate.toISOString()}&endTime=${endDate.toISOString()}`,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      }
    );

    const sleepData: GoogleFitSleepResponse = await sleepResponse.json();

    // 4. Procesar y combinar los datos
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];

      // Obtener calorías del día
      const calories = caloriesData.bucket?.[i]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal || 0;

      // Obtener pasos del día
      const steps = stepsData.bucket?.[i]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;

      // Calcular horas de sueño del día
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(currentDate);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const daySleep = sleepData.session?.filter((session: GoogleFitSession) => {
        const sessionStart = new Date(Number(session.startTimeMillis));
        return sessionStart >= dayStart && 
               sessionStart < dayEnd && 
               session.activityType === 72;
      });

      const sleepHours = daySleep?.reduce((total: number, session: GoogleFitSession) => {
        const duration = (Number(session.endTimeMillis) - Number(session.startTimeMillis)) / (1000 * 60 * 60);
        return total + duration;
      }, 0) || 0;

      weeklyData.push({
        date: dateStr,
        calories: Math.round(calories),
        steps,
        sleep: Math.round(sleepHours * 10) / 10 // Redondear a 1 decimal
      });
    }

    return NextResponse.json({
      success: true,
      data: weeklyData
    });

  } catch (error) {
    console.error('Error fetching weekly data:', error);
    return NextResponse.json({ 
      error: 'Error fetching weekly data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 