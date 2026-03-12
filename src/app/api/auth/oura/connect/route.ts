import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  encodeOuraCookie,
  getOuraCookieOptions,
  OURA_OAUTH_COOKIE_NAME,
} from "@/lib/oura-oauth-cookie";

const OURA_AUTHORIZE_URL = "https://cloud.ouraring.com/oauth/authorize";

/**
 * Oura OAuth 2.0 — Step 1
 * Store fid + random state in a cookie, then redirect to Oura authorization.
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.OURA_CLIENT_ID;
  const redirectUri =
    process.env.OURA_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_URL || "https://app.livmore.life"}/api/auth/oura/callback`;

  if (!clientId || !redirectUri) {
    console.error("[oura connect] Missing OURA_CLIENT_ID or redirect URI");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  const fidParam = req.nextUrl.searchParams.get("fid");
  const fid = fidParam ? parseInt(fidParam, 10) : NaN;

  if (!Number.isInteger(fid) || fid < 1) {
    return NextResponse.json(
      { error: "fid is required and must be a positive integer" },
      { status: 400 }
    );
  }

  const state = crypto.randomBytes(16).toString("hex");

  const payload = encodeOuraCookie({ state, fid });
  const cookieOptions = getOuraCookieOptions();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "daily",
    state,
  });

  const redirectToOura = `${OURA_AUTHORIZE_URL}?${params.toString()}`;
  const res = NextResponse.redirect(redirectToOura, 302);
  res.cookies.set(OURA_OAUTH_COOKIE_NAME, payload, cookieOptions);
  return res;
}
