import { NextResponse } from 'next/server';
import { GarminService } from '@/lib/garmin-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');
    const timezone = searchParams.get('timezone') || 'UTC';

    if (!user_fid) {
      return NextResponse.json({ error: 'user_fid es requerido' }, { status: 400 });
    }

    // Convertir a la zona horaria del usuario
    const now = new Date();
    const userDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const startOfDay = new Date(userDate);
    startOfDay.setHours(0, 0, 0, 0);

    const activity = await GarminService.getDailyActivity(Number(user_fid), startOfDay);

    return NextResponse.json(activity);
  } catch (error) {
    console.error('Error al obtener datos de Garmin:', error);
    return NextResponse.json(
      { error: 'Error al obtener datos de Garmin' },
      { status: 500 }
    );
  }
} 