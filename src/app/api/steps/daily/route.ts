import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

/**
 * GET /api/steps/daily?fid=123&date=2026-03-06
 *    → steps for that single day (user identified by fid)
 *
 * GET /api/steps/daily?fid=123&from=2026-03-01&to=2026-03-07
 *    → steps for each day in the range (inclusive)
 *
 * Response: { success, steps: { date, steps, attestation_hash } | { date, steps, attestation_hash }[] }
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fidParam = searchParams.get("fid");
    const dateParam = searchParams.get("date");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const fid = fidParam ? parseInt(fidParam, 10) : NaN;
    if (!Number.isInteger(fid) || fid < 1) {
      return NextResponse.json(
        { success: false, error: "fid is required and must be a positive integer" },
        { status: 400 }
      );
    }

    const hasSingleDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam);
    const hasRange =
      fromParam &&
      toParam &&
      /^\d{4}-\d{2}-\d{2}$/.test(fromParam) &&
      /^\d{4}-\d{2}-\d{2}$/.test(toParam);

    if (!hasSingleDate && !hasRange) {
      return NextResponse.json(
        { success: false, error: "Provide date=YYYY-MM-DD or from=YYYY-MM-DD&to=YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // Resolve user_id from fid
    const userRows = await sql`
      SELECT id FROM "2026_users" WHERE fid = ${fid} LIMIT 1
    `;
    if (userRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }
    const userId = userRows[0].id as number;

    type StepRow = { date: string; steps: number; attestation_hash: string | null };
    let rows: StepRow[];

    if (hasSingleDate) {
      rows = (await sql`
        SELECT date::text, steps, attestation_hash
        FROM "2026_daily_steps"
        WHERE user_id = ${userId} AND date = ${dateParam}
        LIMIT 1
      `) as StepRow[];
    } else {
      if (fromParam! > toParam!) {
        return NextResponse.json(
          { success: false, error: "from must be <= to" },
          { status: 400 }
        );
      }
      rows = (await sql`
        SELECT date::text, steps, attestation_hash
        FROM "2026_daily_steps"
        WHERE user_id = ${userId}
          AND date >= ${fromParam}
          AND date <= ${toParam}
        ORDER BY date ASC
      `) as StepRow[];
    }

    const steps = rows.map((r) => ({
      date: r.date,
      steps: Number(r.steps),
      attestation_hash: r.attestation_hash ?? null,
    }));

    return NextResponse.json({
      success: true,
      steps: hasSingleDate ? (steps[0] ?? null) : steps,
    });
  } catch (err) {
    console.error("[api/steps/daily] Error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
