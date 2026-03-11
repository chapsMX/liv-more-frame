import { sql } from "@/lib/db";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

export type AttestShareData = {
  fid: number;
  date: string;
  steps: number;
  attestationHash: string;
  username: string | null;
  displayName: string | null;
};

export async function getAttestShareData(
  fid: number,
  date: string
): Promise<AttestShareData | null> {
  try {
    const userRows = await sql`
      SELECT id FROM "2026_users" WHERE fid = ${fid} LIMIT 1
    `;
    if (userRows.length === 0) return null;

    const userId = userRows[0].id as number;

    const stepRows = (await sql`
      SELECT date::text, steps, attestation_hash
      FROM "2026_daily_steps"
      WHERE user_id = ${userId} AND date = ${date} AND attestation_hash IS NOT NULL
      LIMIT 1
    `) as { date: string; steps: number; attestation_hash: string }[];

    const row = stepRows[0];
    if (!row?.attestation_hash) return null;

    let username: string | null = null;
    let displayName: string | null = null;
    try {
      const client = new NeynarAPIClient({
        apiKey: process.env.NEYNAR_API_KEY || "",
      });
      const res = await client.fetchBulkUsers({ fids: [fid] });
      if (res.users[0]) {
        username = res.users[0].username ?? null;
        displayName = res.users[0].display_name ?? null;
      }
    } catch {
      // Continue without Neynar data
    }

    return {
      fid,
      date,
      steps: Number(row.steps),
      attestationHash: row.attestation_hash,
      username,
      displayName,
    };
  } catch {
    return null;
  }
}

export function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
