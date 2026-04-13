/**
 * OAuth 1.0a HMAC-SHA1 signature for Garmin Connect API (OAuth 1.0 apps).
 * Used when the portal only provides OAuth 1.0 credentials.
 */
import { createHmac } from "crypto";

/** RFC 3986 percent-encode for OAuth 1.0 (encode all except unreserved) */
function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/!/g, "%21").replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\*/g, "%2A").replace(/~/g, "%7E");
}

function buildSignatureBaseString(
  method: string,
  url: string,
  params: Array<{ key: string; value: string }>
): string {
  const sorted = [...params].sort((a, b) => {
    const k = a.key.localeCompare(b.key);
    return k !== 0 ? k : a.value.localeCompare(b.value);
  });
  const paramStr = sorted.map((p) => `${percentEncode(p.key)}=${percentEncode(p.value)}`).join("&");
  return `${method}&${percentEncode(url)}&${percentEncode(paramStr)}`;
}

function signHmacSha1(key: string, baseString: string): string {
  return createHmac("sha1", key).update(baseString).digest("base64");
}

export type OAuth1RequestTokenParams = {
  consumerKey: string;
  consumerSecret: string;
  callbackUrl: string;
};

/**
 * Step 1: Get unauthorized request token from Garmin.
 * POST https://connectapi.garmin.com/oauth-service/oauth/request_token
 */
export async function getRequestToken(params: OAuth1RequestTokenParams): Promise<{
  oauth_token: string;
  oauth_token_secret: string;
}> {
  const { consumerKey, consumerSecret, callbackUrl } = params;
  const url = "https://connectapi.garmin.com/oauth-service/oauth/request_token";
  const method = "POST";

  const nonce = createHmac("sha1", String(Date.now())).update(Math.random().toString()).digest("hex").slice(0, 32);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams: Array<{ key: string; value: string }> = [
    { key: "oauth_callback", value: callbackUrl },
    { key: "oauth_consumer_key", value: consumerKey },
    { key: "oauth_nonce", value: nonce },
    { key: "oauth_signature_method", value: "HMAC-SHA1" },
    { key: "oauth_timestamp", value: timestamp },
    { key: "oauth_version", value: "1.0" },
  ];

  const baseString = buildSignatureBaseString(method, url, oauthParams);
  const signingKey = `${percentEncode(consumerSecret)}&`;
  const signature = signHmacSha1(signingKey, baseString);

  const authHeader =
    'OAuth oauth_callback="' +
    percentEncode(callbackUrl) +
    '", oauth_consumer_key="' +
    percentEncode(consumerKey) +
    '", oauth_nonce="' +
    percentEncode(nonce) +
    '", oauth_signature="' +
    percentEncode(signature) +
    '", oauth_signature_method="HMAC-SHA1", oauth_timestamp="' +
    timestamp +
    '", oauth_version="1.0"';

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Garmin request_token failed: ${res.status} ${text}`);
  }

  const body = await res.text();
  const parsed = new URLSearchParams(body);
  const oauth_token = parsed.get("oauth_token");
  const oauth_token_secret = parsed.get("oauth_token_secret");
  if (!oauth_token || !oauth_token_secret) {
    throw new Error("Garmin request_token: missing oauth_token or oauth_token_secret");
  }
  return { oauth_token, oauth_token_secret };
}

export type OAuth1AccessTokenParams = {
  consumerKey: string;
  consumerSecret: string;
  oauthToken: string;
  oauthTokenSecret: string;
  oauthVerifier: string;
};

/**
 * Step 3: Exchange request token + verifier for access token.
 * POST https://connectapi.garmin.com/oauth-service/oauth/access_token
 */
export async function getAccessToken(params: OAuth1AccessTokenParams): Promise<{
  oauth_token: string;
  oauth_token_secret: string;
}> {
  const { consumerKey, consumerSecret, oauthToken, oauthTokenSecret, oauthVerifier } = params;
  const url = "https://connectapi.garmin.com/oauth-service/oauth/access_token";
  const method = "POST";

  const nonce = createHmac("sha1", String(Date.now())).update(Math.random().toString()).digest("hex").slice(0, 32);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams: Array<{ key: string; value: string }> = [
    { key: "oauth_consumer_key", value: consumerKey },
    { key: "oauth_nonce", value: nonce },
    { key: "oauth_signature_method", value: "HMAC-SHA1" },
    { key: "oauth_timestamp", value: timestamp },
    { key: "oauth_token", value: oauthToken },
    { key: "oauth_verifier", value: oauthVerifier },
    { key: "oauth_version", value: "1.0" },
  ];

  const baseString = buildSignatureBaseString(method, url, oauthParams);
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(oauthTokenSecret)}`;
  const signature = signHmacSha1(signingKey, baseString);

  const authHeader =
    'OAuth oauth_consumer_key="' +
    percentEncode(consumerKey) +
    '", oauth_nonce="' +
    percentEncode(nonce) +
    '", oauth_signature="' +
    percentEncode(signature) +
    '", oauth_signature_method="HMAC-SHA1", oauth_timestamp="' +
    timestamp +
    '", oauth_token="' +
    percentEncode(oauthToken) +
    '", oauth_verifier="' +
    percentEncode(oauthVerifier) +
    '", oauth_version="1.0"';

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Garmin access_token failed: ${res.status} ${text}`);
  }

  const body = await res.text();
  const parsed = new URLSearchParams(body);
  const accessToken = parsed.get("oauth_token");
  const accessTokenSecret = parsed.get("oauth_token_secret");
  if (!accessToken || !accessTokenSecret) {
    throw new Error("Garmin access_token: missing oauth_token or oauth_token_secret");
  }
  return { oauth_token: accessToken, oauth_token_secret: accessTokenSecret };
}

/** Garmin OAuth 1.0 user authorization URL (step 2) */
export const GARMIN_OAUTH1_AUTHORIZE_URL = "https://connect.garmin.com/partner/oauthConfirm";

export type OAuth1SignedGetParams = {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  url: string;
};

/**
 * Perform a signed GET request with user OAuth 1.0 credentials (e.g. Wellness API).
 */
export async function oauth1SignedGet<T = unknown>(params: OAuth1SignedGetParams): Promise<T> {
  const { consumerKey, consumerSecret, accessToken, accessTokenSecret, url } = params;
  const method = "GET";

  const nonce = createHmac("sha1", String(Date.now())).update(Math.random().toString()).digest("hex").slice(0, 32);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams: Array<{ key: string; value: string }> = [
    { key: "oauth_consumer_key", value: consumerKey },
    { key: "oauth_nonce", value: nonce },
    { key: "oauth_signature_method", value: "HMAC-SHA1" },
    { key: "oauth_timestamp", value: timestamp },
    { key: "oauth_token", value: accessToken },
    { key: "oauth_version", value: "1.0" },
  ];

  const baseString = buildSignatureBaseString(method, url, oauthParams);
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(accessTokenSecret)}`;
  const signature = signHmacSha1(signingKey, baseString);

  const authHeader =
    'OAuth oauth_consumer_key="' +
    percentEncode(consumerKey) +
    '", oauth_nonce="' +
    percentEncode(nonce) +
    '", oauth_signature="' +
    percentEncode(signature) +
    '", oauth_signature_method="HMAC-SHA1", oauth_timestamp="' +
    timestamp +
    '", oauth_token="' +
    percentEncode(accessToken) +
    '", oauth_version="1.0"';

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: authHeader,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Garmin signed GET failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<T>;
}

const GARMIN_WELLNESS_API_BASE = "https://apis.garmin.com/wellness-api";

/**
 * Get the Garmin Health API user id (persists across tokens).
 * GET https://apis.garmin.com/wellness-api/rest/user/id
 */
export async function getWellnessUserId(params: {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}): Promise<string> {
  const url = `${GARMIN_WELLNESS_API_BASE}/rest/user/id`;
  const data = await oauth1SignedGet<{ userId: string }>({
    ...params,
    url,
  });
  if (!data?.userId || typeof data.userId !== "string") {
    throw new Error("Garmin Wellness API: missing userId in response");
  }
  return data.userId;
}
