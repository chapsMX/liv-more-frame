import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const { user_fid } = await request.json();

    if (!user_fid) {
      return NextResponse.json({ success: false, error: 'Missing user_fid' }, { status: 400 });
    }

    // Revocar el token de acceso pero mantener el provider
    await sql`
      UPDATE user_connections 
      SET google_token = NULL, 
          refresh_token = NULL, 
          token_expiry = NULL,
          updated_at = NOW()
      WHERE user_fid = ${user_fid}
      AND provider = 'google'
    `;

    return NextResponse.json({ 
      success: true, 
      message: 'Google Fit access revoked successfully' 
    });

  } catch (error) {
    console.error('Error revoking Google Fit access:', error);
    return NextResponse.json(
      { success: false, error: 'Error revoking Google Fit access' },
      { status: 500 }
    );
  }
} 