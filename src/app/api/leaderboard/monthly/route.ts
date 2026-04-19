import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year  = parseInt(searchParams.get('year')  ?? new Date().getFullYear().toString())
  const month = parseInt(searchParams.get('month') ?? (new Date().getMonth() + 1).toString())

  const rows = await sql`
    SELECT
      u.id,
      u.fid,
      u.username,
      u.display_name,
      u.basename,
      u.eth_address,
      u.auth_type,
      u.og,
      SUM(ds.steps) AS total_steps,
      COUNT(ds.date) AS days_attested,
      RANK() OVER (ORDER BY SUM(ds.steps) DESC) AS rank
    FROM "2026_daily_steps" ds
    JOIN "2026_users" u ON u.id = ds.user_id
    WHERE
      ds.attestation_hash IS NOT NULL
      AND EXTRACT(YEAR  FROM ds.date) = ${year}
      AND EXTRACT(MONTH FROM ds.date) = ${month}
    GROUP BY u.id, u.fid, u.username, u.display_name, u.basename, u.eth_address, u.auth_type, u.og
    ORDER BY total_steps DESC
  `

  return NextResponse.json(rows)
}
