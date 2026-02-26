import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export type EnsureUserBody = {
  fid: number;
  username?: string | null;
  eth_address?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EnsureUserBody;
    const { fid, username = null, eth_address = null } = body;

    if (!fid || typeof fid !== "number") {
      return NextResponse.json(
        { success: false, error: "fid is required and must be a number" },
        { status: 400 }
      );
    }

    const existing = await sql`
      SELECT id, fid, username, eth_address, created_at, updated_at, provider, og
      FROM "2026_users"
      WHERE fid = ${fid}
      LIMIT 1
    `;

    if (existing.length > 0) {
      const row = existing[0];
      return NextResponse.json({
        success: true,
        user: {
          id: row.id,
          fid: Number(row.fid),
          username: row.username,
          eth_address: row.eth_address,
          created_at: row.created_at,
          updated_at: row.updated_at,
          provider: row.provider,
          og: Boolean(row.og),
        },
        created: false,
      });
    }

    const inserted = await sql`
      INSERT INTO "2026_users" (fid, username, eth_address)
      VALUES (${fid}, ${username}, ${eth_address})
      RETURNING id, fid, username, eth_address, created_at, updated_at, provider, og
    `;

    const row = inserted[0];
    if (!row) {
      return NextResponse.json(
        { success: false, error: "Insert failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: row.id,
        fid: Number(row.fid),
        username: row.username,
        eth_address: row.eth_address,
        created_at: row.created_at,
        updated_at: row.updated_at,
        provider: row.provider,
        og: Boolean(row.og),
      },
      created: true,
    });
  } catch (error) {
    console.error("[api/user] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export type PatchUserBody = {
  fid: number;
  og?: boolean;
};

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as PatchUserBody;
    const { fid, og } = body;

    if (!fid || typeof fid !== "number") {
      return NextResponse.json(
        { success: false, error: "fid is required and must be a number" },
        { status: 400 }
      );
    }

    if (og !== true) {
      return NextResponse.json(
        { success: false, error: "og must be true" },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE "2026_users"
      SET og = true, updated_at = now()
      WHERE fid = ${fid}
      RETURNING id, fid, username, eth_address, created_at, updated_at, provider, og
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const row = result[0];
    return NextResponse.json({
      success: true,
      user: {
        id: row.id,
        fid: Number(row.fid),
        username: row.username,
        eth_address: row.eth_address,
        created_at: row.created_at,
        updated_at: row.updated_at,
        provider: row.provider,
        og: Boolean(row.og),
      },
    });
  } catch (error) {
    console.error("[api/user] PATCH Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
