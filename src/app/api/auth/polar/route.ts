import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  encodePolarCookie,
  getPolarCookieOptions,
  POLAR_OAUTH_COOKIE_NAME,
} from "@/lib/polar-oauth-cookie";

const POLAR_AUTHORIZE_URL = "https://flow.polar.com/oauth2/authorization";

/**
 * Polar OAuth 2.0 — Step 1
 * Store fid + random state in a cookie, then redirect to Polar authorization.
 */
export async function GET(request: Request) {
  const clientId = process.env.POLAR_CLIENT_ID;
  const redirectUri = process.env.POLAR_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    console.error("[polar auth] Missing POLAR_CLIENT_ID or POLAR_REDIRECT_URI");
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

  const state = crypto.randomBytes(16).toString("hex");

  const payload = encodePolarCookie({ state, fid });
  const cookieOptions = getPolarCookieOptions();

  const authorizeUrl = new URL(POLAR_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authorizeUrl.toString(), 302);
  res.cookies.set(POLAR_OAUTH_COOKIE_NAME, payload, cookieOptions);
  return res;
}
