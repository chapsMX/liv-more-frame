import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    const rows = await sql`
      SELECT
        r.record_type,
        r.steps,
        r.period_start,
        r.period_end,
        r.achieved_at,
        u.fid,
        u.username
      FROM "2026_records" r
      JOIN "2026_users" u ON u.id = r.user_id
      WHERE r.record_type IN ('daily', 'weekly', 'monthly')
      ORDER BY r.record_type
    `
    return NextResponse.json(rows)
  } catch (e) {
    console.error('[leaderboard/alltime]', e)
    return NextResponse.json([])
  }
}
