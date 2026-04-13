import { ImageResponse } from "next/og";
import { loadImage } from "@/lib/og-utils";
import { sql } from "@/lib/db";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";

const size = {
  width: 1200,
  height: 800,
};

/**
 * GET /api/img-general/[id]
 * Generates dynamic OG image for general weekly leaderboard share.
 * id = competition id (from 2026_weekly_competitions)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const competitionId = parseInt(id, 10);
    if (!Number.isInteger(competitionId) || competitionId < 1) {
      return new Response("Invalid competition id", { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_URL?.replace(/\/+$/, "") ?? "";

    // Fetch competition and leaderboard data
    const compRows = await sql`
      SELECT id, week_number, year, week_start, week_end
      FROM "2026_weekly_competitions"
      WHERE id = ${competitionId}
      LIMIT 1
    `;

    const competition = compRows[0] as
      | { id: number; week_number: number; year: number; week_start: string; week_end: string }
      | undefined;

    if (!competition) {
      return new Response("Competition not found", { status: 404 });
    }

    const leaderboard = await sql`
      SELECT u.fid, u.username, SUM(ds.steps)::int AS total_valid_steps,
        RANK() OVER (ORDER BY SUM(ds.steps) DESC) AS rank
      FROM "2026_daily_steps" ds
      JOIN "2026_users" u ON u.id = ds.user_id
      WHERE ds.attestation_hash IS NOT NULL
        AND ds.date BETWEEN ${competition.week_start}::date AND ${competition.week_end}::date
      GROUP BY u.id, u.fid, u.username
      ORDER BY total_valid_steps DESC
      LIMIT 10
    `;

    const startDate = new Date(competition.week_start + "T12:00:00Z").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const endDate = new Date(competition.week_end + "T12:00:00Z").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const weekLabel = `Week ${competition.week_number}, ${competition.year} (${startDate} – ${endDate})`;

    // Load logo
    const logoImage = await loadImage(`${appUrl}/livMore_w.png`);

    // Load font (adjust path if needed)
    let fontData: ArrayBuffer | null = null;
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

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            padding: 40,
            backgroundColor: "#101827",
          }}
        >
          {/* Logo */}
          <img
            src={`data:image/png;base64,${Buffer.from(logoImage).toString("base64")}`}
            alt="LivMore"
            style={{
              width: 100,
              position: "absolute",
              top: 24,
              right: 24,
            }}
          />

          {/* Title */}
          <div
            style={{
              color: "white",
              fontSize: 48,
              fontFamily: fontData ? "ProtoMono" : "monospace",
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            LivMore Weekly Leaderboard
          </div>
          <div
            style={{
              color: "#9ca3af",
              fontSize: 24,
              fontFamily: fontData ? "ProtoMono" : "monospace",
              marginBottom: 32,
            }}
          >
            {weekLabel}
          </div>

          {/* Leaderboard table placeholder - customize structure when image design is defined */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              width: "100%",
              maxWidth: 800,
            }}
          >
            {(leaderboard as { rank: number; fid: number; username: string | null; total_valid_steps: number }[]).map((row, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 20px",
                  background: "rgba(30,30,40,0.7)",
                  borderRadius: 12,
                  color: "white",
                  fontSize: 28,
                  fontFamily: fontData ? "ProtoMono" : "monospace",
                }}
              >
                <span>#{Number(row.rank)}</span>
                <span>@{row.username ?? `fid-${row.fid}`}</span>
                <span>{Number(row.total_valid_steps).toLocaleString()} steps</span>
              </div>
            ))}
          </div>

          <div
            style={{
              color: "#6b7280",
              fontSize: 20,
              fontFamily: fontData ? "ProtoMono" : "monospace",
              marginTop: 24,
            }}
          >
            One step at a time 👟
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
    console.error("[img-general] Failed to generate image:", e);
    return new Response("Failed to generate image", { status: 500 });
  }
}
