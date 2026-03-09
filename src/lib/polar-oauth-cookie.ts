/**
 * Cookie storage for Polar OAuth 2.0 flow.
 * Stores the user's fid and a random state value during the authorization redirect.
 */
const COOKIE_NAME = "polar_oauth";
const MAX_AGE = 600; // 10 minutes

export type PolarOAuthCookiePayload = {
  state: string;
  fid: number;
};

export function getPolarCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: MAX_AGE,
    path: "/",
  };
}

export function encodePolarCookie(payload: PolarOAuthCookiePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodePolarCookie(
  value: string
): PolarOAuthCookiePayload | null {
  try {
    const json = Buffer.from(value, "base64url").toString("utf-8");
    const data = JSON.parse(json) as PolarOAuthCookiePayload;
    if (typeof data.state === "string" && Number.isInteger(data.fid)) {
      return { state: data.state, fid: data.fid };
    }
  } catch {
    // ignore
  }
  return null;
}

export { COOKIE_NAME as POLAR_OAUTH_COOKIE_NAME };
