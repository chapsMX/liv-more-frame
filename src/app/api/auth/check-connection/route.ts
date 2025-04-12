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

    // Verificar si el usuario tiene alguna conexión con tokens válidos
    const result = await sql`
      SELECT 
        CASE 
          WHEN COUNT(*) > 0 THEN true 
          ELSE false 
        END as is_connected
      FROM user_connections
      WHERE user_fid = ${user_fid}
        AND (
          (provider = 'google' AND google_token IS NOT NULL) OR
          (provider = 'oura' AND refresh_token IS NOT NULL) OR
          (provider = 'whoop' AND refresh_token IS NOT NULL) OR
          (provider = 'garmin' AND refresh_token IS NOT NULL)
        )
    `;

    return NextResponse.json({
      isConnected: result[0]?.is_connected || false
    });

  } catch (error) {
    console.error('Error checking user connection:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 