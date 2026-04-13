import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

/** POST /api/user/disconnect — disconnect current device (Garmin/Polar) for the user identified by fid */
export async function POST(req: NextRequest) {
  try {
    let body: { fid?: number };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON" },
        { status: 400 }
      );
    }

    const fid = body.fid != null ? Number(body.fid) : NaN;
    if (!Number.isInteger(fid) || fid < 1) {
      return NextResponse.json(
        { success: false, error: "fid is required and must be a positive integer" },
        { status: 400 }
      );
    }

    const userRows = await sql`
      SELECT id, provider FROM "2026_users" WHERE fid = ${fid} LIMIT 1
    `;
    if (userRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const userId = userRows[0].id as number;
    const provider = userRows[0].provider as string | null;

    if (!provider) {
      return NextResponse.json(
        { success: true, user: { fid, provider: null }, message: "No device connected" },
        { status: 200 }
      );
    }

    await sql`
      UPDATE "2026_provider_connections"
      SET disconnected_at = now()
      WHERE user_id = ${userId}
        AND provider = ${provider}
        AND disconnected_at IS NULL
    `;

    const updated = await sql`
      UPDATE "2026_users"
      SET provider = null, updated_at = now()
      WHERE fid = ${fid}
      RETURNING id, fid, username, eth_address, created_at, updated_at, provider, og
    `;

    if (updated.length === 0) {
      return NextResponse.json(
        { success: false, error: "Update failed" },
        { status: 500 }
      );
    }

    const row = updated[0];
    return NextResponse.json({
      success: true,
      user: {
        id: row.id,
        fid: Number(row.fid),
        username: row.username,
        eth_address: row.eth_address,
        created_at: row.created_at,
        updated_at: row.updated_at,
        provider: row.provider as null,
        og: Boolean(row.og),
      },
    });
  } catch (err) {
    console.error("[api/user/disconnect] Error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
