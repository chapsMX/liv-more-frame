import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    if (!fid) {
      return NextResponse.json({ error: 'Missing user FID' }, { status: 400 });
    }
    const result = await sql`SELECT can_create FROM whitelist_users WHERE user_fid = ${fid}`;
    if (result.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ can_create: result[0].can_create });
  } catch (error) {
    console.error('Error fetching can_create:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 