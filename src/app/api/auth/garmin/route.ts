import { NextResponse } from "next/server";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  encodePkceCookie,
  getPkceCookieOptions,
  PKCE_COOKIE_NAME,
} from "@/lib/garmin-pkce";

const GARMIN_AUTH_URL = "https://connect.garmin.com/oauth2Confirm";

export async function GET(request: Request) {
  const clientId = process.env.GARMIN_CLIENT_ID;
  const redirectUri = process.env.GARMIN_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    console.error("[garmin auth] Missing GARMIN_CLIENT_ID or GARMIN_REDIRECT_URI");
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

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  const payload = encodePkceCookie({ state, code_verifier: codeVerifier, fid });
  const cookieOptions = getPkceCookieOptions();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    redirect_uri: redirectUri,
    state,
  });

  const redirectToGarmin = `${GARMIN_AUTH_URL}?${params.toString()}`;
  const res = NextResponse.redirect(redirectToGarmin, 302);
  res.cookies.set(PKCE_COOKIE_NAME, payload, cookieOptions);
  return res;
}
