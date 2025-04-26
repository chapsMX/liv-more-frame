import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

interface GarminActivity {
  startTimeInSeconds: number;
  durationInSeconds: number;
  steps: number;
  calories: number;
}

interface GarminSleep {
  startTimeInSeconds: number;
  durationInSeconds: number;
  sleepTimeSeconds: number;
}

export class GarminService {
  private static async getAccessToken(user_fid: number): Promise<string> {
    const connection = await sql`
      SELECT refresh_token, token_expiry
      FROM user_connections
      WHERE user_fid = ${user_fid} AND provider = 'garmin'
    `;

    if (!connection[0]?.refresh_token) {
      throw new Error('Usuario no conectado a Garmin');
    }

    return connection[0].refresh_token;
  }

  private static async makeRequest(endpoint: string, token: string) {
    const response = await fetch(`https://connect.garmin.com${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error en la petición a Garmin: ${response.statusText}`);
    }

    return response.json();
  }

  static async getDailyActivity(user_fid: number, date: Date): Promise<{
    steps: number;
    calories: number;
    sleepHours: number;
  }> {
    try {
      const token = await this.getAccessToken(user_fid);
      
      // Obtener actividades del día
      const activities = await this.makeRequest(
        `/modern/proxy/activitylist-service/activities/search/activities?startDate=${date.toISOString()}&endDate=${new Date(date.getTime() + 86400000).toISOString()}`,
        token
      ) as GarminActivity[];

      // Obtener datos de sueño del día
      const sleep = await this.makeRequest(
        `/modern/proxy/wellness-service/sleep/dailySleepData?date=${date.toISOString()}`,
        token
      ) as GarminSleep;

      // Calcular totales
      const totalSteps = activities.reduce((sum, activity) => sum + (activity.steps || 0), 0);
      const totalCalories = activities.reduce((sum, activity) => sum + (activity.calories || 0), 0);
      const sleepHours = sleep ? sleep.sleepTimeSeconds / 3600 : 0;

      return {
        steps: totalSteps,
        calories: Math.round(totalCalories),
        sleepHours: Number(sleepHours.toFixed(1)),
      };
    } catch (error) {
      console.error('Error al obtener datos de Garmin:', error);
      throw error;
    }
  }

  static async getWeeklyActivity(user_fid: number, startDate: Date, endDate: Date): Promise<{
    steps: number;
    calories: number;
    sleepHours: number;
  }> {
    try {
      const token = await this.getAccessToken(user_fid);
      
      // Obtener actividades de la semana
      const activities = await this.makeRequest(
        `/modern/proxy/activitylist-service/activities/search/activities?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        token
      ) as GarminActivity[];

      // Obtener datos de sueño de la semana
      const sleep = await this.makeRequest(
        `/modern/proxy/wellness-service/sleep/dailySleepData?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        token
      ) as GarminSleep[];

      // Calcular totales
      const totalSteps = activities.reduce((sum, activity) => sum + (activity.steps || 0), 0);
      const totalCalories = activities.reduce((sum, activity) => sum + (activity.calories || 0), 0);
      const totalSleepHours = sleep.reduce((sum, s) => sum + (s.sleepTimeSeconds || 0), 0) / 3600;

      return {
        steps: totalSteps,
        calories: Math.round(totalCalories),
        sleepHours: Number(totalSleepHours.toFixed(1)),
      };
    } catch (error) {
      console.error('Error al obtener datos semanales de Garmin:', error);
      throw error;
    }
  }
} 