import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

/**
 * Returns past weeks with their leaderboards from 2026_weekly_winners.
 * Uses 2026_weekly_competitions (status = 'completed') and 2026_weekly_winners (category = 'general').
 */
export async function GET() {
  try {
    const compRows = await sql`
      SELECT id, week_number, year, week_start, week_end
      FROM "2026_weekly_competitions"
      WHERE status = 'completed'
      ORDER BY year DESC, week_number DESC
    `

    const history: Array<{
      week_number: number
      year: number
      week_start: string
      week_end: string
      general: Array<{
        id: number
        fid: number
        username: string
        og: boolean
        total_valid_steps: number
        rank: number
      }>
    }> = []

    for (const c of compRows as Array<{ id: number; week_number: number; year: number; week_start: string; week_end: string }>) {
      const winners = await sql`
        SELECT
          u.id,
          u.fid,
          u.username,
          u.og,
          w.total_valid_steps,
          w.rank
        FROM "2026_weekly_winners" w
        JOIN "2026_users" u ON u.id = w.user_id
        WHERE w.competition_id = ${c.id}
          AND w.category = 'general'
        ORDER BY w.rank ASC
      `

      history.push({
        week_number: c.week_number,
        year: c.year,
        week_start: c.week_start,
        week_end: c.week_end,
        general: winners.map((r) => ({
          id: r.id,
          fid: r.fid,
          username: r.username ?? '',
          og: r.og,
          total_valid_steps: r.total_valid_steps,
          rank: Number(r.rank),
        })),
      })
    }

    return NextResponse.json(history)
  } catch (e) {
    console.error('[leaderboard/weekly/history]', e)
    return NextResponse.json([])
  }
}
