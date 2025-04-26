import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');

    if (!user_fid) {
      return NextResponse.json(
        { error: 'user_fid is required' },
        { status: 400 }
      );
    }

    // Primero verificamos si tiene conexión con Garmin
    const garminResult = await sql`
      SELECT 1 as connected
      FROM user_connections_garmin
      WHERE user_fid = ${user_fid}
        AND access_token IS NOT NULL
    `;

    if (garminResult.length > 0) {
      return NextResponse.json({
        provider: 'garmin'
      });
    }

    // Si no tiene Garmin, verificamos Google
    const googleResult = await sql`
      SELECT 1 as connected
      FROM user_connections
      WHERE user_fid = ${user_fid}
        AND provider = 'google'
        AND google_token IS NOT NULL
    `;

    if (googleResult.length > 0) {
      return NextResponse.json({
        provider: 'google'
      });
    }

    // Si no tiene ninguno conectado
    return NextResponse.json({
      provider: null
    });

  } catch (error) {
    console.error('Error checking provider:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 