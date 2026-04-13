import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

/**
 * Returns chronological feed of all daily steps (with or without attestations).
 * Ordered by date DESC, most recent first.
 * Limit 200 entries.
 */
export async function GET(req: NextRequest) {
  try {
    const limit = Math.min(
      parseInt(req.nextUrl.searchParams.get("limit") ?? "200", 10) || 200,
      500
    );

    const rows = await sql`
      SELECT
        ds.id,
        ds.user_id,
        u.fid,
        u.username,
        u.og,
        ds.date,
        ds.steps,
        ds.attestation_hash IS NOT NULL AS attested
      FROM "2026_daily_steps" ds
      JOIN "2026_users" u ON u.id = ds.user_id
      ORDER BY ds.date DESC, ds.steps DESC
      LIMIT ${limit}
    `;

    return NextResponse.json(rows);
  } catch (e) {
    console.error("[leaderboard/feed]", e);
    return NextResponse.json([], { status: 500 });
  }
}
