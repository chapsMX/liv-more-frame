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

    // Fetch user's position in this week (rank must be computed over ALL participants, then filter)
    const userRows = await sql`
      SELECT fid, username, total_valid_steps, rank
      FROM (
        SELECT u.fid, u.username, SUM(ds.steps)::int AS total_valid_steps,
          RANK() OVER (ORDER BY SUM(ds.steps) DESC) AS rank
        FROM "2026_daily_steps" ds
        JOIN "2026_users" u ON u.id = ds.user_id
        WHERE ds.attestation_hash IS NOT NULL
          AND ds.date BETWEEN ${competition.week_start}::date AND ${competition.week_end}::date
        GROUP BY u.id, u.fid, u.username
      ) ranked
      WHERE fid = ${fid}
    `;

    const userRow = userRows[0] as
      | { fid: number; username: string | null; total_valid_steps: number; rank: number }
      | undefined;

    // Fetch pfp from Neynar - explicitly match by fid, embed as base64 for reliable rendering
    let pfpDataUrl: string | null = null;
    try {
      const neynar = new NeynarAPIClient({ apiKey: process.env.NEYNAR_API_KEY || "" });
      const res = await neynar.fetchBulkUsers({ fids: [fid] });
      const user = Array.isArray(res.users) ? res.users.find((u: { fid?: number }) => Number(u.fid) === fid) : res.users?.[0];
      const pfpUrl = user?.pfp_url ?? null;
      if (pfpUrl) {
        const pfpRes = await fetch(pfpUrl);
        if (pfpRes.ok) {
          const pfpBuf = await pfpRes.arrayBuffer();
          const mime = pfpRes.headers.get("content-type")?.split(";")[0] || "image/png";
          pfpDataUrl = `data:${mime};base64,${Buffer.from(pfpBuf).toString("base64")}`;
        }
      }
    } catch {
      // Continue without pfp
    }

    // Load dailyShare (transparent, 30% opacity) and logo
    let bgImage: ArrayBuffer;
    let logoImage: ArrayBuffer;
    try {
      bgImage = await loadImage(`${appUrl}/dailyShare.png`);
      logoImage = await loadImage(`${appUrl}/livMore_w.png`);
    } catch (imgErr) {
      console.error("[img-fid] Failed to load images:", imgErr);
      return new Response("Failed to load images", { status: 500 });
    }

    // Load font - required for correct rendering (match working example)
    const fontPaths = [
      path.join(process.cwd(), "src/styles/fonts/ProtoMono-Regular.otf"),
      path.join(process.cwd(), "public/fonts/ProtoMono-Regular.otf"),
      path.join(process.cwd(), "fonts/ProtoMono-Regular.otf"),
    ];
    let fontData: Buffer | null = null;
    for (const fontPath of fontPaths) {
      if (fs.existsSync(fontPath)) {
        fontData = fs.readFileSync(fontPath);
        break;
      }
    }
    if (!fontData) {
      console.error("[img-fid] Font not found at any path:", fontPaths);
      return new Response("Font not found", { status: 500 });
    }

    const bgBase64 = Buffer.from(bgImage).toString("base64");
    const logoBase64 = Buffer.from(logoImage).toString("base64");

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "40px",
            position: "relative",
            backgroundColor: "#101827",
          }}
        >
          {/* dailyShare: transparent, 30% opacity */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `url(data:image/png;base64,${bgBase64})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: 0.3,
            }}
          />
          {/* LivMore logo watermark (fondo de agua) */}

          {/* Content (above watermark) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              height: "100%",
              width: "100%",
              position: "relative",
              zIndex: 1,
            }}
          >
          {/* Profile Picture */}
          <div
            style={{
              width: "410px",
              height: "410px",
              borderRadius: "70px",
              border: "4px solid #ff8800",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "10px",
            }}
          >
            {pfpDataUrl ? (
              <img
                src={pfpDataUrl}
                alt="Profile"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#374151",
                  color: "#9ca3af",
                  fontSize: 48,
                  fontFamily: "ProtoMono",
                }}
              >
                ?
              </div>
            )}
          </div>

          {/* Leaderboard text */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              marginBottom: "10px",
            }}
          >
            <div
              style={{
                color: "white",
                fontSize: "42px",
                fontFamily: "ProtoMono",
                fontWeight: "700",
                textAlign: "center",
              }}
            >
              {userRow
                ? `I'm currently #${Number(userRow.rank)} on the $steps leaderboard!`
                : "Can you beat me?"}
            </div>
            {userRow && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    color: "#ff8800",
                    fontSize: "36px",
                    fontFamily: "ProtoMono",
                    fontWeight: "400",
                  }}
                >
                  Current Steps:
                </span>
                <span
                  style={{
                    color: "white",
                    fontSize: "40px",
                    fontFamily: "ProtoMono",
                    fontWeight: "400",
                  }}
                >
                  {Number(userRow.total_valid_steps).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Logo */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: "auto",
            }}
          >
            <img
              src={`data:image/png;base64,${logoBase64}`}
              alt="LivMore"
              style={{
                width: "32px",
                height: "auto",
                marginBottom: "10px",
              }}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                color: "#9ca3af",
                fontSize: "36px",
                fontFamily: "ProtoMono",
                fontWeight: "400",
                textAlign: "center",
              }}
            >
              <div>Connect your device to track your daily steps</div>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: "32px",
                  fontFamily: "ProtoMono",
                }}
              >
                And try to beat me!
              </div>
            </div>
          </div>
          </div>
        </div>
      ),
      {
        ...size,
        fonts: [
          {
            name: "ProtoMono",
            data: fontData as unknown as ArrayBuffer,
            weight: 400,
            style: "normal",
          },
        ],
      }
    );
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[img-fid] Failed to generate image:", err.message, err.stack);
    return new Response(`Failed to generate image: ${err.message}`, { status: 500 });
  }
}
