/**
 * Cookie storage for Garmin OAuth 1.0 flow: request token secret + fid.
 * Callback receives oauth_token and oauth_verifier from query; we need the token secret from this cookie.
 */
const COOKIE_NAME = "garmin_oauth1";
const MAX_AGE = 600; // 10 minutes

export type OAuth1CookiePayload = {
  oauth_token_secret: string;
  fid: number;
};

export function getOAuth1CookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: MAX_AGE,
    path: "/",
  };
}

export function encodeOAuth1Cookie(payload: OAuth1CookiePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeOAuth1Cookie(value: string): OAuth1CookiePayload | null {
  try {
    const json = Buffer.from(value, "base64url").toString("utf-8");
    const data = JSON.parse(json) as OAuth1CookiePayload;
    if (typeof data.oauth_token_secret === "string" && Number.isInteger(data.fid)) {
      return { oauth_token_secret: data.oauth_token_secret, fid: data.fid };
    }
  } catch {
    // ignore
  }
  return null;
}

export { COOKIE_NAME as GARMIN_OAUTH1_COOKIE_NAME };
