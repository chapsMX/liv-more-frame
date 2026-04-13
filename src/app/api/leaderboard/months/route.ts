import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

/**
 * Returns distinct (year, month) that have attested steps.
 * Range: March 2026 - December 2026 (and beyond as data grows).
 */
export async function GET() {
  try {
    const rows = await sql`
      SELECT DISTINCT
        EXTRACT(YEAR FROM ds.date)::int AS year,
        EXTRACT(MONTH FROM ds.date)::int AS month
      FROM "2026_daily_steps" ds
      WHERE ds.attestation_hash IS NOT NULL
        AND ds.date >= '2026-03-01'::date
      ORDER BY year, month
    `
    return NextResponse.json(rows)
  } catch (e) {
    console.error('[leaderboard/months]', e)
    return NextResponse.json([])
  }
}
