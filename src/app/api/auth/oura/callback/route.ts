import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import {
  decodeOuraCookie,
  OURA_OAUTH_COOKIE_NAME,
} from "@/lib/oura-oauth-cookie";

const OURA_TOKEN_URL = "https://api.ouraring.com/oauth/token";
const OURA_PERSONAL_INFO_URL =
  "https://api.ouraring.com/v2/usercollection/personal_info";

/**
 * Oura OAuth 2.0 — Step 2 (callback)
 * Exchange authorization code for tokens, persist connection in DB, redirect home.
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.OURA_CLIENT_ID;
  const clientSecret = process.env.OURA_CLIENT_SECRET;
  const redirectUri =
    process.env.OURA_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_URL || "https://app.livmore.life"}/api/auth/oura/callback`;
  const appUrl = process.env.NEXT_PUBLIC_URL || "https://app.livmore.life";

  if (!clientId || !clientSecret || !redirectUri) {
    console.error("[oura callback] Missing Oura env vars");
    return NextResponse.redirect(`${appUrl}?oura=error`, 302);
  }

  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");
  const errorParam = req.nextUrl.searchParams.get("error");

  if (errorParam) {
    console.error("[oura callback] Authorization error:", errorParam);
    return NextResponse.redirect(`${appUrl}?oura=error`, 302);
  }

  if (!code || !stateParam) {
    console.error("[oura callback] Missing code or state:", { code, state: stateParam });
    return NextResponse.redirect(`${appUrl}?oura=error`, 302);
  }

  // Validate state from cookie
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(OURA_OAUTH_COOKIE_NAME)?.value;
  if (!cookieValue) {
    return NextResponse.redirect(`${appUrl}?oura=error`, 302);
  }

  const payload = decodeOuraCookie(cookieValue);
  if (!payload || payload.state !== stateParam) {
    return NextResponse.redirect(`${appUrl}?oura=error`, 302);
  }

  const { fid } = payload;

  // --- 1. Exchange code for tokens ---
  let accessToken: string;
  let refreshToken: string;
  let expiresIn: number;

  try {
    const tokenRes = await fetch(OURA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error("[oura callback] Token exchange failed:", tokenRes.status, text);
      return NextResponse.redirect(`${appUrl}?oura=error`, 302);
    }

    const tokenData = await tokenRes.json();
    accessToken = tokenData.access_token;
    refreshToken = tokenData.refresh_token;
    expiresIn = tokenData.expires_in ?? 86400;

    if (!accessToken || !refreshToken) {
      console.error("[oura callback] Missing tokens in response");
      return NextResponse.redirect(`${appUrl}?oura=error`, 302);
    }
  } catch (e) {
    console.error("[oura callback] Token exchange error:", e);
    return NextResponse.redirect(`${appUrl}?oura=error`, 302);
  }

  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

  // --- 2. Fetch oura_user_id ---
  let ouraUserId: string;

  try {
    const userRes = await fetch(OURA_PERSONAL_INFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      const text = await userRes.text();
      console.error("[oura callback] Failed to fetch personal info:", userRes.status, text);
      return NextResponse.redirect(`${appUrl}?oura=error`, 302);
    }

    const userData = await userRes.json();
    ouraUserId = String(userData.id ?? userData.user_id ?? "");
    if (!ouraUserId) {
      console.error("[oura callback] No id in personal_info response");
      return NextResponse.redirect(`${appUrl}?oura=error`, 302);
    }
  } catch (e) {
    console.error("[oura callback] Personal info fetch error:", e);
    return NextResponse.redirect(`${appUrl}?oura=error`, 302);
  }

  // --- 3. Resolve our internal user ---
  let userId: number;

  try {
    const userRows = await sql`
      SELECT id FROM "2026_users" WHERE fid = ${fid} LIMIT 1
    `;
    if (userRows.length === 0) {
      console.error("[oura callback] User not found for fid:", fid);
      return NextResponse.redirect(`${appUrl}?oura=error`, 302);
    }
    userId = userRows[0].id as number;
  } catch (e) {
    console.error("[oura callback] DB user lookup failed:", e);
    return NextResponse.redirect(`${appUrl}?oura=error`, 302);
  }

  // --- 4. Persist connection in DB (follow Polar pattern) ---
  try {
    // Upsert provider_connections (one row per user)
    const connRows = await sql`
      INSERT INTO "2026_provider_connections" (user_id, provider)
      VALUES (${userId}, 'oura')
      ON CONFLICT (user_id) DO UPDATE SET
        provider = 'oura',
        disconnected_at = null
      RETURNING id
    `;
    const connectionId = connRows[0]?.id as number;

    // Upsert oura_connections
    await sql`
      INSERT INTO "2026_oura_connections"
        (connection_id, oura_user_id, access_token, refresh_token, token_expires_at)
      VALUES
        (${connectionId}, ${ouraUserId}, ${accessToken}, ${refreshToken}, ${tokenExpiresAt})
      ON CONFLICT (oura_user_id) DO UPDATE SET
        connection_id = EXCLUDED.connection_id,
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expires_at = EXCLUDED.token_expires_at
    `;

    // Keep 2026_users.provider in sync
    await sql`
      UPDATE "2026_users"
      SET provider = 'oura', updated_at = now()
      WHERE fid = ${fid}
    `;

    console.log(
      `[oura callback] user ${userId} (fid ${fid}) connected, oura_user_id: ${ouraUserId}`
    );
  } catch (e) {
    console.error("[oura callback] DB error:", e);
    return NextResponse.redirect(`${appUrl}?oura=error`, 302);
  }

  const res = NextResponse.redirect(`${appUrl}?oura=success`, 302);
  res.cookies.delete(OURA_OAUTH_COOKIE_NAME);
  return res;
}
