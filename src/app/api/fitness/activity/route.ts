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

async function refreshToken(oauth2Client: OAuth2Client) {
  const response = await oauth2Client.getAccessToken();
  return response.token;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');
    const timezone = searchParams.get('timezone') || 'UTC';

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

    const { token_expiry, refresh_token } = tokensResult[0];
    let { access_token } = tokensResult[0];

    // Verificar si el token ha expirado
    if (new Date(token_expiry) < new Date()) {
      try {
        const oauth2Client = new OAuth2Client(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        );

        oauth2Client.setCredentials({
          refresh_token: refresh_token
        });

        const newToken = await refreshToken(oauth2Client);
        
        // Actualizar tokens en la base de datos
        await sql`
          UPDATE user_connections
          SET google_token = ${newToken!},
              token_expiry = ${new Date(Date.now() + 3600000)}
          WHERE user_fid = ${user_fid} AND provider = 'google'
        `;

        access_token = newToken!;
      } catch (error) {
        console.error('Error refreshing token:', error);
        return NextResponse.json({ error: 'Failed to refresh token' }, { status: 401 });
      }
    }

    // 3. Obtener datos de actividad para hoy
    const now = new Date();
    
    // Convertir a la zona horaria del usuario
    const userDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const startOfDay = new Date(userDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(userDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Convertir a timestamps para la API de Google
    const startTimeMillis = startOfDay.getTime();
    const endTimeMillis = endOfDay.getTime();

    console.log('Consultando datos de actividad:', {
      startTime: new Date(startTimeMillis).toISOString(),
      endTime: new Date(endTimeMillis).toISOString(),
      timezone: timezone,
      userLocalTime: userDate.toLocaleString('en-US', { timeZone: timezone })
    });

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
          bucketByTime: { durationMillis: endTimeMillis - startTimeMillis },
          startTimeMillis: startTimeMillis,
          endTimeMillis: endTimeMillis
        })
      }
    );

    if (!caloriesResponse.ok) {
      const errorData = await caloriesResponse.text();
      console.error('Error en respuesta de calorías:', errorData);
      throw new Error(`Error al obtener calorías: ${caloriesResponse.status}`);
    }

    const caloriesData: GoogleFitResponse = await caloriesResponse.json();
    console.log('Datos de calorías recibidos:', caloriesData);

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
          bucketByTime: { durationMillis: endTimeMillis - startTimeMillis },
          startTimeMillis: startTimeMillis,
          endTimeMillis: endTimeMillis
        })
      }
    );

    if (!stepsResponse.ok) {
      const errorData = await stepsResponse.text();
      console.error('Error en respuesta de pasos:', errorData);
      throw new Error(`Error al obtener pasos: ${stepsResponse.status}`);
    }

    const stepsData: GoogleFitResponse = await stepsResponse.json();
    console.log('Datos de pasos recibidos:', stepsData);

    // 3.3 Obtener horas de sueño
    const sleepResponse = await fetch(
      `https://www.googleapis.com/fitness/v1/users/me/sessions?activityType=72&startTime=${startOfDay.toISOString()}&endTime=${endOfDay.toISOString()}`,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      }
    );

    if (!sleepResponse.ok) {
      const errorData = await sleepResponse.text();
      console.error('Error en respuesta de sueño:', errorData);
      throw new Error(`Error al obtener sueño: ${sleepResponse.status}`);
    }

    const sleepData: GoogleFitSleepData = await sleepResponse.json();
    console.log('Datos de sueño recibidos:', sleepData);

    // Procesar los datos
    const calories = Math.round(caloriesData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal || 0);
    const steps = stepsData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
    
    const sleepHours = sleepData.session?.reduce((total: number, session: GoogleFitSession) => {
      const duration = (Number(session.endTimeMillis) - Number(session.startTimeMillis)) / (1000 * 60 * 60);
      return total + duration;
    }, 0) || 0;

    // Guardar los datos en la base de datos
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

    const response = {
      success: true,
      activity: {
        calories,
        steps,
        sleepHours: Math.round(sleepHours * 10) / 10 // Redondear a 1 decimal
      }
    };

    console.log('Respuesta final:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error detallado en fetchActivityData:', error);
    return NextResponse.json({ 
      error: 'Error fetching activity data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 