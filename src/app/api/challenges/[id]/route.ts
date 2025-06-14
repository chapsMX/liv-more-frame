import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';


const sql = neon(process.env.DATABASE_URL!);

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing challenge id' }, { status: 400 });
    }
    const result = await sql`
      SELECT id, title, description, activity_type, objective_type, goal_amount, duration_days, start_date, image_url, is_official, points_value, badge_id, entry_cost, visible, challenge_status
      FROM challenges
      WHERE id = ${id}
    `;
    if (result.length === 0) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }
    // Obtener los participantes (solo FIDs)
    type ParticipantRow = { user_fid: number };
    const participants = await sql`
      SELECT user_fid FROM challenge_participants WHERE challenge_id = ${id}
    ` as ParticipantRow[];
    const participantFids = participants.map((p) => p.user_fid);
    return NextResponse.json({ challenge: { ...result[0], participants: participantFids } });
  } catch (error) {
    console.error('Error fetching challenge detail:', error);
    return NextResponse.json({ error: 'Error fetching challenge detail' }, { status: 500 });
  }
} 