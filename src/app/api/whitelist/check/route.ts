import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL!);
    
    // Consultar si el usuario está en whitelist
    const result = await sql`
      SELECT is_whitelisted 
      FROM whitelist_users 
      WHERE user_fid = ${fid}
    `;

    return NextResponse.json({
      isWhitelisted: result.length > 0 ? result[0].is_whitelisted : false
    });

  } catch (error) {
    console.error('Error checking whitelist status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 