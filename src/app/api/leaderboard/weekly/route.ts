import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

/**
 * Returns the current week competition and leaderboard (attested steps only).
 * Competition from 2026_weekly_competitions (status = 'active').
 * Leaderboard computed from 2026_daily_steps for that week.
 */
export async function GET() {
  try {
    const compRows = await sql`
      SELECT id, week_number, year, week_start, week_end
      FROM "2026_weekly_competitions"
      WHERE status = 'active'
      ORDER BY year DESC, week_number DESC
      LIMIT 1
    `

    const competition = compRows[0] as { id: number; week_number: number; year: number; week_start: string; week_end: string } | undefined

    if (!competition) {
      return NextResponse.json({
        competition: null,
        general: [],
      })
    }

    const general = await sql`
      SELECT
        u.id,
        u.fid,
        u.username,
        u.og,
        SUM(ds.steps)::int AS total_valid_steps,
        RANK() OVER (ORDER BY SUM(ds.steps) DESC) AS rank
      FROM "2026_daily_steps" ds
      JOIN "2026_users" u ON u.id = ds.user_id
      WHERE ds.attestation_hash IS NOT NULL
        AND ds.date BETWEEN ${competition.week_start}::date AND ${competition.week_end}::date
      GROUP BY u.id, u.fid, u.username, u.og
      ORDER BY total_valid_steps DESC
    `

    return NextResponse.json({
      competition: {
        id: competition.id,
        week_number: competition.week_number,
        year: competition.year,
        week_start: competition.week_start,
        week_end: competition.week_end,
      },
      general: general.map((r) => ({
        id: r.id,
        fid: r.fid,
        username: r.username ?? '',
        og: r.og,
        total_valid_steps: r.total_valid_steps,
        rank: Number(r.rank),
      })),
    })
  } catch (e) {
    console.error('[leaderboard/weekly]', e)
    return NextResponse.json({ competition: null, general: [] })
  }
}
