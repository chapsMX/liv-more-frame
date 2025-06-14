import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    if (!fid) {
      return NextResponse.json({ error: 'Missing fid' }, { status: 400 });
    }
    // Buscar los retos a los que el usuario se ha unido
    const challenges = await sql`
      SELECT c.id, c.title, c.start_date, c.duration_days
      FROM challenges c
      JOIN challenge_participants p ON c.id = p.challenge_id
      WHERE p.user_fid = ${fid} AND c.visible = true
      ORDER BY c.start_date DESC
    `;
    return NextResponse.json({ challenges });
  } catch (error) {
    console.error('Error fetching joined challenges:', error);
    return NextResponse.json({ error: 'Error fetching joined challenges' }, { status: 500 });
  }
} 