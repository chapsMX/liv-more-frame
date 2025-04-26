import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const { user_fid } = await request.json();

    if (!user_fid) {
      return NextResponse.json({ success: false, error: 'Missing user_fid' }, { status: 400 });
    }

    // Revocar los tokens pero mantener el registro
    await sql`
      UPDATE user_connections_garmin 
      SET access_token = NULL,
          oauth_token = NULL,
          oauth_token_secret = NULL,
          refresh_token = NULL,
          token_expiry = NULL,
          updated_at = NOW()
      WHERE user_fid = ${user_fid}
    `;

    return NextResponse.json({ 
      success: true, 
      message: 'Garmin access revoked successfully' 
    });

  } catch (error) {
    console.error('Error revoking Garmin access:', error);
    return NextResponse.json(
      { success: false, error: 'Error revoking Garmin access' },
      { status: 500 }
    );
  }
} 