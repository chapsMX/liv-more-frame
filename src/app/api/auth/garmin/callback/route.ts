import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import {
  decodePkceCookie,
  PKCE_COOKIE_NAME,
} from "@/lib/garmin-pkce";

const GARMIN_TOKEN_URL = "https://diauth.garmin.com/di-oauth2-service/oauth/token";

export async function GET(request: Request) {
  const clientId = process.env.GARMIN_CLIENT_ID;
  const clientSecret = process.env.GARMIN_CLIENT_SECRET;
  const redirectUri = process.env.GARMIN_REDIRECT_URI;
  const appUrl = process.env.NEXT_PUBLIC_URL || "https://app.livmore.life";

  if (!clientId || !clientSecret || !redirectUri) {
    console.error("[garmin callback] Missing Garmin env vars");
    return NextResponse.redirect(`${appUrl}?error=server_error`, 302);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}?error=missing_code_or_state`, 302);
  }

  const cookieStore = await cookies();
  const pkceCookie = cookieStore.get(PKCE_COOKIE_NAME)?.value;
  if (!pkceCookie) {
    return NextResponse.redirect(`${appUrl}?error=invalid_state`, 302);
  }

  const payload = decodePkceCookie(pkceCookie);
  if (!payload || payload.state !== state) {
    return NextResponse.redirect(`${appUrl}?error=invalid_state`, 302);
  }

  const { code_verifier, fid } = payload;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    code_verifier: code_verifier,
    redirect_uri: redirectUri,
  });

  let tokenRes: Response;
  try {
    tokenRes = await fetch(GARMIN_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (e) {
    console.error("[garmin callback] Token request failed:", e);
    return NextResponse.redirect(`${appUrl}?error=token_request_failed`, 302);
  }

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error("[garmin callback] Token response not ok:", tokenRes.status, text);
    return NextResponse.redirect(`${appUrl}?error=token_exchange_failed`, 302);
  }

  let data: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  try {
    data = await tokenRes.json();
  } catch {
    return NextResponse.redirect(`${appUrl}?error=token_parse_failed`, 302);
  }

  const accessToken = data.access_token;
  const refreshToken = data.refresh_token;
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 86400;

  if (!accessToken || !refreshToken) {
    return NextResponse.redirect(`${appUrl}?error=missing_tokens`, 302);
  }

  // Recommended: subtract 600s from expiration so we refresh in time
  const expiresAt = new Date(Date.now() + (expiresIn - 600) * 1000).toISOString();

  try {
    await sql`
      UPDATE "2026_users"
      SET
        provider = 'garmin',
        provider_access_token = ${accessToken},
        provider_refresh_token = ${refreshToken},
        provider_token_expires_at = ${expiresAt},
        updated_at = now()
      WHERE fid = ${fid}
    `;
  } catch (e) {
    console.error("[garmin callback] DB update failed:", e);
    return NextResponse.redirect(`${appUrl}?error=db_update_failed`, 302);
  }

  const res = NextResponse.redirect(`${appUrl}?garmin=connected`, 302);
  res.cookies.delete(PKCE_COOKIE_NAME);
  return res;
}
