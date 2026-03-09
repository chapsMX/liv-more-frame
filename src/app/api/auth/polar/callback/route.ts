import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import {
  decodePolarCookie,
  POLAR_OAUTH_COOKIE_NAME,
} from "@/lib/polar-oauth-cookie";

const TOKEN_URL = "https://polarremote.com/v2/oauth2/token";
const REGISTER_URL = "https://www.polaraccesslink.com/v3/users";

/**
 * Polar OAuth 2.0 — Step 2 (callback)
 * Exchange authorization code for access token, register user in Polar,
 * persist connection in DB, trigger backfill, redirect home.
 */
export async function GET(request: Request) {
  const clientId = process.env.POLAR_CLIENT_ID;
  const clientSecret = process.env.POLAR_CLIENT_SECRET;
  const redirectUri = process.env.POLAR_REDIRECT_URI;
  const appUrl = process.env.NEXT_PUBLIC_URL || "https://app.livmore.life";

  if (!clientId || !clientSecret || !redirectUri) {
    console.error("[polar callback] Missing Polar env vars");
    return NextResponse.redirect(`${appUrl}?error=server_error`, 302);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    console.error("[polar callback] Authorization error:", errorParam);
    return NextResponse.redirect(
      `${appUrl}?error=polar_auth_denied&detail=${errorParam}`,
      302
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${appUrl}?error=missing_authorization_code`,
      302
    );
  }

  // Validate state from cookie
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(POLAR_OAUTH_COOKIE_NAME)?.value;
  if (!cookieValue) {
    return NextResponse.redirect(`${appUrl}?error=invalid_state`, 302);
  }

  const payload = decodePolarCookie(cookieValue);
  if (!payload || payload.state !== stateParam) {
    return NextResponse.redirect(`${appUrl}?error=invalid_state`, 302);
  }

  const { fid } = payload;

  // --- 1. Exchange authorization code for access token ---
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  let accessToken: string;
  let polarUserId: number;
  let expiresIn: number | undefined;

  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json;charset=UTF-8",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error(
        "[polar callback] Token exchange failed:",
        tokenRes.status,
        errText
      );
      return NextResponse.redirect(
        `${appUrl}?error=token_exchange_failed`,
        302
      );
    }

    const tokenData = await tokenRes.json();
    accessToken = tokenData.access_token;
    polarUserId = tokenData.x_user_id;
    expiresIn = tokenData.expires_in;

    if (!accessToken || !polarUserId) {
      console.error("[polar callback] Missing access_token or x_user_id in token response");
      return NextResponse.redirect(
        `${appUrl}?error=token_exchange_failed`,
        302
      );
    }
  } catch (e) {
    console.error("[polar callback] Token exchange error:", e);
    return NextResponse.redirect(
      `${appUrl}?error=token_exchange_failed`,
      302
    );
  }

  // --- 2. Resolve our internal user ---
  let userId: number;
  try {
    const userRows = await sql`
      SELECT id FROM "2026_users" WHERE fid = ${fid} LIMIT 1
    `;
    if (userRows.length === 0) {
      console.error("[polar callback] User not found for fid:", fid);
      return NextResponse.redirect(`${appUrl}?error=user_not_found`, 302);
    }
    userId = userRows[0].id as number;
  } catch (e) {
    console.error("[polar callback] DB user lookup failed:", e);
    return NextResponse.redirect(`${appUrl}?error=db_error`, 302);
  }

  // --- 3. Register user in Polar AccessLink ---
  const memberId = `livmore-${userId}`;
  try {
    const registerRes = await fetch(REGISTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ "member-id": memberId }),
    });

    if (registerRes.status === 409) {
      console.log("[polar callback] User already registered with Polar, continuing");
    } else if (!registerRes.ok) {
      const errText = await registerRes.text();
      console.error(
        "[polar callback] Polar user registration failed:",
        registerRes.status,
        errText
      );
      return NextResponse.redirect(
        `${appUrl}?error=polar_registration_failed`,
        302
      );
    }
  } catch (e) {
    console.error("[polar callback] Polar user registration error:", e);
    return NextResponse.redirect(
      `${appUrl}?error=polar_registration_failed`,
      302
    );
  }

  // --- 4. Persist connection in DB ---
  try {
    const tokenExpiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    // Upsert provider connection
    const connRows = await sql`
      INSERT INTO "2026_provider_connections" (user_id, provider)
      VALUES (${userId}, 'polar')
      ON CONFLICT (user_id) DO UPDATE SET
        provider = 'polar',
        disconnected_at = null
      RETURNING id
    `;
    const connectionId = connRows[0]?.id as number;

    // Upsert polar-specific connection
    await sql`
      INSERT INTO "2026_polar_connections"
        (connection_id, polar_user_id, access_token, token_expires_at, member_id)
      VALUES
        (${connectionId}, ${polarUserId}, ${accessToken}, ${tokenExpiresAt}, ${memberId})
      ON CONFLICT (polar_user_id) DO UPDATE SET
        connection_id = EXCLUDED.connection_id,
        access_token = EXCLUDED.access_token,
        token_expires_at = EXCLUDED.token_expires_at,
        member_id = EXCLUDED.member_id
    `;

    // Keep 2026_users.provider in sync
    await sql`
      UPDATE "2026_users"
      SET provider = 'polar', updated_at = now()
      WHERE fid = ${fid}
    `;
  } catch (e) {
    console.error("[polar callback] DB update failed:", e);
    return NextResponse.redirect(`${appUrl}?error=db_update_failed`, 302);
  }

  // --- 5. Trigger backfill ---
  const baseUrl = process.env.NEXT_PUBLIC_URL;
  if (baseUrl) {
    try {
      await fetch(`${baseUrl}/api/polar/backfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, daysBack: 5 }),
      });
    } catch (e) {
      console.error("[polar callback] backfill request failed:", e);
    }
  }

  // --- 6. Redirect home ---
  const res = NextResponse.redirect(`${appUrl}?polar=connected`, 302);
  res.cookies.delete(POLAR_OAUTH_COOKIE_NAME);
  return res;
}
