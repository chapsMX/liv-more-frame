import { ImageResponse } from "next/og";
import { loadImage } from "@/lib/og-utils";
import { sql } from "@/lib/db";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const size = {
  width: 1200,
  height: 800,
};

/**
 * GET /api/img-fid/[id]
 * Generates dynamic OG image for user's weekly position share.
 * id formats (date = YYYYMMDD for cache busting):
 *   - "competitionId-fid-date" (e.g. "1-20701-20250307")
 *   - "week_number-fid-date" (e.g. "11-20701-20250307")
 *   - "year-week_number-fid-date" (e.g. "2026-11-20701-20250307")
 *   - "competitionId-fid" or "week_number-fid" (no date, legacy)
 */
function isDatePart(s: string): boolean {
  return /^\d{8}$/.test(s) && parseInt(s.slice(4, 6), 10) >= 1 && parseInt(s.slice(4, 6), 10) <= 12;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parts = id.split("-");
    if (parts.length < 2) {
      return new Response("Invalid id format", { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_URL?.replace(/\/+$/, "") ?? "";
    if (!appUrl) {
      console.error("[img-fid] NEXT_PUBLIC_URL not set");
      return new Response("Server config error", { status: 500 });
    }

    // Parse: extract optional date from end (YYYYMMDD)
    let rest = parts;
    if (parts.length >= 3 && isDatePart(parts[parts.length - 1])) {
      rest = parts.slice(0, -1);
    }

    const fid = parseInt(rest[rest.length - 1], 10);
    if (!Number.isInteger(fid) || fid < 1) {
      return new Response("Invalid fid", { status: 400 });
    }

    let competition: { id: number; week_number: number; year: number; week_start: string; week_end: string } | undefined;

    if (rest.length === 2) {
      const first = parseInt(rest[0], 10);
      if (!Number.isInteger(first)) {
        return new Response("Invalid id", { status: 400 });
      }
      const byId = await sql`
        SELECT id, week_number, year, week_start, week_end
        FROM "2026_weekly_competitions"
        WHERE id = ${first}
        LIMIT 1
      `;
      if (byId.length > 0) {
        competition = byId[0] as typeof competition;
      } else {
        const byWeek = await sql`
          SELECT id, week_number, year, week_start, week_end
          FROM "2026_weekly_competitions"
          WHERE week_number = ${first} AND status = 'active'
          ORDER BY year DESC
          LIMIT 1
        `;
        competition = byWeek[0] as typeof competition;
      }
    } else if (rest.length === 3) {
      const year = parseInt(rest[0], 10);
      const weekNumber = parseInt(rest[1], 10);
      if (!Number.isInteger(year) || !Number.isInteger(weekNumber)) {
        return new Response("Invalid year-week_number-fid format", { status: 400 });
      }
      const byYearWeek = await sql`
        SELECT id, week_number, year, week_start, week_end
        FROM "2026_weekly_competitions"
        WHERE year = ${year} AND week_number = ${weekNumber}
        LIMIT 1
      `;
      competition = byYearWeek[0] as typeof competition;
    } else {
      return new Response("Invalid id format", { status: 400 });
    }

    if (!competition) {
      return new Response("Competition not found", { status: 404 });
    }

    // Fetch user's position in this week
    const userRows = await sql`
      SELECT u.fid, u.username, SUM(ds.steps)::int AS total_valid_steps,
        RANK() OVER (ORDER BY SUM(ds.steps) DESC) AS rank
      FROM "2026_daily_steps" ds
      JOIN "2026_users" u ON u.id = ds.user_id
      WHERE ds.attestation_hash IS NOT NULL
        AND ds.date BETWEEN ${competition.week_start}::date AND ${competition.week_end}::date
        AND u.fid = ${fid}
      GROUP BY u.id, u.fid, u.username
    `;

    const userRow = userRows[0] as
      | { fid: number; username: string | null; total_valid_steps: number; rank: number }
      | undefined;

    if (!userRow) {
      return new Response("User not found in this week's leaderboard", { status: 404 });
    }

    // Fetch pfp URL from Neynar
    let pfpUrl: string | null = null;
    try {
      const neynar = new NeynarAPIClient({ apiKey: process.env.NEYNAR_API_KEY || "" });
      const res = await neynar.fetchBulkUsers({ fids: [fid] });
      pfpUrl = res.users[0]?.pfp_url ?? null;
    } catch {
      // Continue without pfp
    }

    // Load background and logo
    let bgImage: ArrayBuffer;
    let logoImage: ArrayBuffer;
    try {
      bgImage = await loadImage(`${appUrl}/dailyShare.png`);
      logoImage = await loadImage(`${appUrl}/livMore_w.png`);
    } catch (imgErr) {
      console.error("[img-fid] Failed to load images:", imgErr);
      return new Response("Failed to load images", { status: 500 });
    }

    // Load font (Node.js fs - skip if unavailable)
    let fontData: ArrayBuffer | null = null;
    try {
      const fontPaths = [
        path.join(process.cwd(), "public/fonts/ProtoMono-Regular.otf"),
        path.join(process.cwd(), "fonts/ProtoMono-Regular.otf"),
      ];
      for (const fontPath of fontPaths) {
        if (fs.existsSync(fontPath)) {
          fontData = fs.readFileSync(fontPath).buffer;
          break;
        }
      }
    } catch {
      // Font optional, use monospace
    }

    const fontFamily = fontData ? "ProtoMono" : "monospace";

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            width: "100%",
            position: "relative",
            backgroundColor: "#101827",
          }}
        >
          {/* Background */}
          <img
            src={`data:image/png;base64,${Buffer.from(bgImage).toString("base64")}`}
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />

          {/* Content overlay - Satori requires display:flex on divs with multiple children */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 48,
              position: "relative",
              zIndex: 1,
            }}
          >
            {/* Profile picture */}
            {pfpUrl ? (
              <img
                src={pfpUrl}
                alt=""
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: "50%",
                  border: "4px solid #ff8800",
                  marginBottom: 32,
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: "50%",
                  border: "4px solid #ff8800",
                  marginBottom: 32,
                  background: "#374151",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9ca3af",
                  fontSize: 48,
                  fontFamily: fontFamily,
                }}
              >
                ?
              </div>
            )}

            {/* Im currently # on the Weekly Leaderboard */}
            <div
              style={{
                display: "flex",
                color: "white",
                fontSize: 42,
                fontFamily: fontFamily,
                fontWeight: 700,
                textAlign: "center",
                marginBottom: 16,
              }}
            >
              I&apos;m currently #{Number(userRow.rank)} on the Weekly Leaderboard
            </div>

            {/* Steps */}
            <div
              style={{
                display: "flex",
                color: "#ff8800",
                fontSize: 36,
                fontFamily: fontFamily,
                marginBottom: 48,
              }}
            >
              Steps: {Number(userRow.total_valid_steps).toLocaleString()}
            </div>

            {/* LivMore logo */}
            <img
              src={`data:image/png;base64,${Buffer.from(logoImage).toString("base64")}`}
              alt="LivMore"
              style={{
                width: 80,
                marginBottom: 16,
              }}
            />

            {/* Taglines */}
            <div
              style={{
                display: "flex",
                color: "#9ca3af",
                fontSize: 20,
                fontFamily: fontFamily,
                textAlign: "center",
                marginBottom: 4,
              }}
            >
              Tracking your healthy habits
            </div>
            <div
              style={{
                display: "flex",
                color: "#6b7280",
                fontSize: 18,
                fontFamily: fontFamily,
                textAlign: "center",
              }}
            >
              One step at a time
            </div>
          </div>
        </div>
      ),
      {
        ...size,
        ...(fontData && {
          fonts: [
            {
              name: "ProtoMono",
              data: fontData,
              style: "normal",
            },
          ],
        }),
      }
    );
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[img-fid] Failed to generate image:", err.message, err.stack);
    return new Response(`Failed to generate image: ${err.message}`, { status: 500 });
  }
}
