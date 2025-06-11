import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const { challenge_id, user_fid } = await request.json();
    if (!challenge_id || !user_fid) {
      return NextResponse.json({ error: 'Missing challenge_id or user_fid' }, { status: 400 });
    }
    // Validar que el reto existe y está visible
    const challenge = await sql`SELECT id, start_date, duration_days FROM challenges WHERE id = ${challenge_id} AND visible = true`;
    if (challenge.length === 0) {
      return NextResponse.json({ error: 'Challenge not found or not visible' }, { status: 404 });
    }
    // Validar que el usuario no esté ya inscrito
    const exists = await sql`SELECT id FROM challenge_participants WHERE challenge_id = ${challenge_id} AND user_fid = ${user_fid}`;
    if (exists.length > 0) {
      return NextResponse.json({ error: 'User already joined this challenge' }, { status: 409 });
    }
    // Insertar participante
    await sql`
      INSERT INTO challenge_participants (challenge_id, user_fid)
      VALUES (${challenge_id}, ${user_fid})
    `;

    // Trigger initial sync of activity data
    const startDate = new Date(challenge[0].start_date);
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + challenge[0].duration_days - 1);

    try {
      const syncRes = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/challenges/sync-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_fid,
          challenge_id,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        })
      });
      
      if (!syncRes.ok) {
        console.error('Error syncing challenge history:', await syncRes.text());
      }
    } catch (syncError) {
      console.error('Error triggering sync:', syncError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error joining challenge:', error);
    return NextResponse.json({ error: 'Error joining challenge' }, { status: 500 });
  }
}