import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json({ success: false, error: 'FID is required' });
    }

    const result = await sql`
      SELECT is_whitelisted, can_use, username, display_name
      FROM whitelist_users 
      WHERE user_fid = ${fid}
    `;

    if (result && result.length > 0) {
      return NextResponse.json({
        success: true,
        isWhitelisted: result[0].is_whitelisted,
        canUse: result[0].can_use,
        username: result[0].username,
        displayName: result[0].display_name
      });
    }

    return NextResponse.json({
      success: true,
      isWhitelisted: false,
      canUse: false
    });
  } catch (error) {
    console.error('Error checking whitelist status:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' });
  }
} 