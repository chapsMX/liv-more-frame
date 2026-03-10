/**
 * One-time script to register the ACTIVITY_SUMMARY webhook with Polar AccessLink.
 *
 * Usage:
 *   npx tsx scripts/register-polar-webhook.ts
 *
 * Required env vars: POLAR_CLIENT_ID, POLAR_CLIENT_SECRET, POLAR_WEBHOOK_SECRET
 * The webhook URL is derived from NEXT_PUBLIC_URL.
 *
 * This only needs to run once per client/environment. Polar registers webhooks
 * at the client level, not per user.
 */

async function main() {
  const clientId = process.env.POLAR_CLIENT_ID;
  const clientSecret = process.env.POLAR_CLIENT_SECRET;
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_URL;

  if (!clientId || !clientSecret) {
    console.error("Missing POLAR_CLIENT_ID or POLAR_CLIENT_SECRET");
    process.exit(1);
  }

  if (!baseUrl) {
    console.error("Missing NEXT_PUBLIC_URL");
    process.exit(1);
  }

  const webhookUrl = `${baseUrl}/api/webhooks/polar/activity`;
  console.log("Registering webhook:", webhookUrl);

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const body = {
    events: ["ACTIVITY_SUMMARY"],
    url: webhookUrl,
  };

  const res = await fetch("https://www.polaraccesslink.com/v3/webhooks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Basic ${basicAuth}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  if (res.ok || res.status === 201) {
    console.log("Webhook registered successfully!");
    console.log("Response:", text);
    console.log("\nIMPORTANT: Copy the 'signature_secret_key' from the response above");
    console.log("and set it as POLAR_WEBHOOK_SECRET in your .env files.");
  } else if (res.status === 409) {
    console.log("Webhook already registered (409). Current config:", text);
    console.log("To update, delete the existing webhook first.");
  } else {
    console.error("Failed to register webhook:", res.status, text);
    process.exit(1);
  }
}

main();
