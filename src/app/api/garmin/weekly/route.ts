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
    
    // Configurar el fin del período (hoy a las 23:59:59.999 en hora local)
    const endDate = new Date(userDate);
    endDate.setHours(23, 59, 59, 999);
    
    // Configurar el inicio del período (6 días antes del fin)
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const activity = await GarminService.getWeeklyActivity(
      Number(user_fid),
      startDate,
      endDate
    );

    return NextResponse.json(activity);
  } catch (error) {
    console.error('Error al obtener datos semanales de Garmin:', error);
    return NextResponse.json(
      { error: 'Error al obtener datos semanales de Garmin' },
      { status: 500 }
    );
  }
} 