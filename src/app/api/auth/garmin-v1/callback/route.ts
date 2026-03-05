import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { getAccessToken } from "@/lib/garmin-oauth1";
import {
  decodeOAuth1Cookie,
  GARMIN_OAUTH1_COOKIE_NAME,
} from "@/lib/garmin-oauth1-cookie";

/**
 * Garmin OAuth 1.0a callback.
 * Step 2: User returns with oauth_token and oauth_verifier; exchange for access token and save to DB.
 */
export async function GET(request: Request) {
  const consumerKey = process.env.GARMIN_CLIENT_ID;
  const consumerSecret = process.env.GARMIN_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_URL || "https://app.livmore.life";

  if (!consumerKey || !consumerSecret) {
    console.error("[garmin-v1 callback] Missing Garmin env vars");
    return NextResponse.redirect(`${appUrl}?error=server_error`, 302);
  }

  const { searchParams } = new URL(request.url);
  const oauthToken = searchParams.get("oauth_token");
  const oauthVerifier = searchParams.get("oauth_verifier");

  if (!oauthToken || !oauthVerifier) {
    return NextResponse.redirect(`${appUrl}?error=missing_oauth_token_or_verifier`, 302);
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(GARMIN_OAUTH1_COOKIE_NAME)?.value;
  if (!cookieValue) {
    return NextResponse.redirect(`${appUrl}?error=invalid_state`, 302);
  }

  const payload = decodeOAuth1Cookie(cookieValue);
  if (!payload) {
    return NextResponse.redirect(`${appUrl}?error=invalid_state`, 302);
  }

  const { oauth_token_secret: oauthTokenSecret, fid } = payload;

  let accessTokenRes: { oauth_token: string; oauth_token_secret: string };
  try {
    accessTokenRes = await getAccessToken({
      consumerKey,
      consumerSecret,
      oauthToken,
      oauthTokenSecret,
      oauthVerifier,
    });
  } catch (e) {
    console.error("[garmin-v1 callback] getAccessToken failed:", e);
    return NextResponse.redirect(`${appUrl}?error=token_exchange_failed`, 302);
  }

  // OAuth 1.0 doesn't return expires_in; tokens are valid until user revokes. Set expires_at to 90 days for column compatibility.
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  try {
    await sql`
      UPDATE "2026_users"
      SET
        provider = 'garmin',
        provider_access_token = ${accessTokenRes.oauth_token},
        provider_refresh_token = ${accessTokenRes.oauth_token_secret},
        provider_token_expires_at = ${expiresAt},
        updated_at = now()
      WHERE fid = ${fid}
    `;
  } catch (e) {
    console.error("[garmin-v1 callback] DB update failed:", e);
    return NextResponse.redirect(`${appUrl}?error=db_update_failed`, 302);
  }

  const res = NextResponse.redirect(`${appUrl}?garmin=connected`, 302);
  res.cookies.delete(GARMIN_OAUTH1_COOKIE_NAME);
  return res;
}
