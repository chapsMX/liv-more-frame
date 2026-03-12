import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

/** User shape returned to client (no tokens) */
function toPublicUser(row: Record<string, unknown>) {
  return {
    id: row.id,
    fid: Number(row.fid),
    username: row.username,
    eth_address: row.eth_address,
    created_at: row.created_at,
    updated_at: row.updated_at,
    provider: row.provider as "garmin" | "polar" | "oura" | null,
    og: Boolean(row.og),
  };
}

export type EnsureUserBody = {
  fid: number;
  username?: string | null;
  eth_address?: string | null;
};

/** GET /api/user?fid= — get user by fid (no create). 404 if not found. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get("fid");
    const fid = fidParam ? parseInt(fidParam, 10) : NaN;

    if (!Number.isInteger(fid) || fid < 1) {
      return NextResponse.json(
        { success: false, error: "fid is required and must be a positive integer" },
        { status: 400 }
      );
    }

    const rows = await sql`
      SELECT id, fid, username, eth_address, created_at, updated_at, provider, og
      FROM "2026_users"
      WHERE fid = ${fid}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: toPublicUser(rows[0]),
    });
  } catch (error) {
    console.error("[api/user] GET Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
        user: toPublicUser(row),
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
      user: toPublicUser(row),
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
  /** Set provider (e.g. after OAuth). Set to null to disconnect and clear tokens. */
  provider?: "garmin" | "polar" | "oura" | null;
  /** Server-only: set by OAuth callback. Do not send from client. */
  provider_access_token?: string | null;
  provider_refresh_token?: string | null;
  provider_token_expires_at?: string | null;
};

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as PatchUserBody;
    const {
      fid,
      og,
      provider,
      provider_access_token,
      provider_refresh_token,
      provider_token_expires_at,
    } = body;

    if (!fid || typeof fid !== "number") {
      return NextResponse.json(
        { success: false, error: "fid is required and must be a number" },
        { status: 400 }
      );
    }

    // Update og only
    if (og === true && provider === undefined) {
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
      return NextResponse.json({
        success: true,
        user: toPublicUser(result[0]),
      });
    }

    // Update provider (and optionally tokens). If provider is null, clear tokens.
    if (provider !== undefined) {
      if (
        provider !== null &&
        provider !== "garmin" &&
        provider !== "polar" &&
        provider !== "oura"
      ) {
        return NextResponse.json(
          { success: false, error: "provider must be 'garmin', 'polar', 'oura', or null" },
          { status: 400 }
        );
      }
      const result = await sql`
        UPDATE "2026_users"
        SET
          updated_at = now(),
          provider = ${provider === null ? null : provider},
          provider_access_token = ${provider === null ? null : provider_access_token ?? null},
          provider_refresh_token = ${provider === null ? null : provider_refresh_token ?? null},
          provider_token_expires_at = ${provider === null ? null : provider_token_expires_at ?? null}
        WHERE fid = ${fid}
        RETURNING id, fid, username, eth_address, created_at, updated_at, provider, og
      `;
      if (result.length === 0) {
        return NextResponse.json(
          { success: false, error: "User not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        user: toPublicUser(result[0]),
      });
    }

    return NextResponse.json(
      { success: false, error: "Provide og: true or provider" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[api/user] PATCH Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
