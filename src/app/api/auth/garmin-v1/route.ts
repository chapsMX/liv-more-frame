import { NextResponse } from "next/server";
import { getRequestToken, GARMIN_OAUTH1_AUTHORIZE_URL } from "@/lib/garmin-oauth1";
import {
  encodeOAuth1Cookie,
  getOAuth1CookieOptions,
  GARMIN_OAUTH1_COOKIE_NAME,
} from "@/lib/garmin-oauth1-cookie";

/**
 * Garmin OAuth 1.0a flow (for apps created with OAuth 1.0 in the portal).
 * Step 1: Get request token, store secret in cookie, redirect user to Garmin to authorize.
 */
export async function GET(request: Request) {
  const consumerKey = process.env.GARMIN_CLIENT_ID;
  const consumerSecret = process.env.GARMIN_CLIENT_SECRET;
  const redirectUri =
    process.env.GARMIN_V1_REDIRECT_URI ||
    (process.env.GARMIN_REDIRECT_URI || "").replace(/\/api\/auth\/garmin\/callback\/?$/i, "/api/auth/garmin-v1/callback");

  if (!consumerKey || !consumerSecret || !redirectUri) {
    console.error("[garmin-v1] Missing GARMIN_CLIENT_ID, GARMIN_CLIENT_SECRET, or GARMIN_REDIRECT_URI");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const fidParam = searchParams.get("fid");
  const fid = fidParam ? parseInt(fidParam, 10) : NaN;

  if (!Number.isInteger(fid) || fid < 1) {
    return NextResponse.json(
      { error: "fid is required and must be a positive integer" },
      { status: 400 }
    );
  }

  let requestToken: { oauth_token: string; oauth_token_secret: string };
  try {
    requestToken = await getRequestToken({
      consumerKey,
      consumerSecret,
      callbackUrl: redirectUri,
    });
  } catch (e) {
    console.error("[garmin-v1] getRequestToken failed:", e);
    return NextResponse.json(
      { error: "Failed to get request token from Garmin" },
      { status: 502 }
    );
  }

  const payload = encodeOAuth1Cookie({
    oauth_token_secret: requestToken.oauth_token_secret,
    fid,
  });
  const cookieOptions = getOAuth1CookieOptions();

  const authorizeUrl = `${GARMIN_OAUTH1_AUTHORIZE_URL}?oauth_token=${encodeURIComponent(requestToken.oauth_token)}`;
  const res = NextResponse.redirect(authorizeUrl, 302);
  res.cookies.set(GARMIN_OAUTH1_COOKIE_NAME, payload, cookieOptions);
  return res;
}
