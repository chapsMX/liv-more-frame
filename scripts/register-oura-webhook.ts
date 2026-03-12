/**
 * One-time script to register Oura webhook subscriptions for daily_activity.
 *
 * Usage:
 *   npx tsx scripts/register-oura-webhook.ts
 *
 * Required env vars: OURA_CLIENT_ID, OURA_CLIENT_SECRET, OURA_VERIFICATION_TOKEN
 * Optional: NEXT_PUBLIC_URL (defaults to https://app.livmore.life)
 *
 * Creates two subscriptions:
 *   - event_type: create (datos nuevos)
 *   - event_type: update (actualizaciones)
 *
 * Loads .env.local automatically if env vars are not set.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local if OURA vars not set (Next.js convention)
if (!process.env.OURA_CLIENT_ID || !process.env.OURA_VERIFICATION_TOKEN) {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        const val = m[2].trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch {
    // try .env as fallback
    try {
      const envPath = resolve(process.cwd(), ".env");
      const content = readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) {
          const key = m[1].trim();
          const val = m[2].trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) process.env[key] = val;
        }
      }
    } catch {
      // ignore
    }
  }
}

const clientId = process.env.OURA_CLIENT_ID;
const clientSecret = process.env.OURA_CLIENT_SECRET;
const verificationToken = process.env.OURA_VERIFICATION_TOKEN;
const baseUrl = process.env.NEXT_PUBLIC_URL || "https://app.livmore.life";
const callbackUrl = `${baseUrl.replace(/\/$/, "")}/api/webhooks/oura/daily`;

async function registerSubscription(
  eventType: "create" | "update"
): Promise<void> {
  const body = {
    callback_url: callbackUrl,
    verification_token: verificationToken,
    event_type: eventType,
    data_type: "daily_activity",
  };

  const res = await fetch("https://api.ouraring.com/v2/webhook/subscription", {
    method: "POST",
    headers: {
      "x-client-id": clientId!,
      "x-client-secret": clientSecret!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  if (res.ok || res.status === 201) {
    console.log(`[${eventType}] Webhook subscription registered successfully`);
    console.log("Response:", text);
  } else {
    console.error(`[${eventType}] Failed:`, res.status, text);
    throw new Error(`Failed to register ${eventType} subscription`);
  }
}

async function main() {
  if (!clientId || !clientSecret || !verificationToken) {
    console.error(
      "Missing env vars. Required: OURA_CLIENT_ID, OURA_CLIENT_SECRET, OURA_VERIFICATION_TOKEN"
    );
    console.error(
      "Run from project root (loads .env.local automatically if present)"
    );
    process.exit(1);
  }

  console.log("Registering Oura webhooks for:", callbackUrl);
  console.log("");

  await registerSubscription("create");
  console.log("");

  await registerSubscription("update");

  console.log("");
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
