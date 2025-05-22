import { loadImage } from "@/lib/og-utils";
import { ImageResponse } from "next/og";
import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const sql = neon(process.env.DATABASE_URL!);

// Force dynamic rendering to ensure fresh image generation on each request
export const dynamic = "force-dynamic";

// Define the dimensions for the generated OpenGraph image
const size = {
  width: 1200,
  height: 800,
};

/**
 * GET handler for generating dynamic OpenGraph images
 * @param request - The incoming HTTP request
 * @param params - Route parameters containing the ID
 * @returns ImageResponse - A dynamically generated image for OpenGraph
 */
export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    // Extract the ID from the route parameters
    const { id } = await params;

    // Get the application's base URL from environment variables
    const appUrl = process.env.NEXT_PUBLIC_URL;

    // Fetch challenge data from database
    const challengeResult = await sql`
      SELECT c.title, c.image_url, c.description, c.activity_type, c.start_date
      FROM challenges c
      WHERE c.id = ${id}
    `;

    if (challengeResult.length === 0) {
      throw new Error('Challenge not found');
    }

    const challenge = challengeResult[0];

    // Format start date
    const startDate = new Date(challenge.start_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    // Load the logo image from the public directory
    const logoImage = await loadImage(`${appUrl}/dailyShare.png`);

    // Load challenge image if available, otherwise use a default
    const challengeImage = challenge.image_url 
      ? await loadImage(challenge.image_url)
      : await loadImage(`${appUrl}/dailyShare.png`);

    // Cargar fuente ProtoMono
    const fontPath = path.join(process.cwd(), 'src/styles/fonts/ProtoMono-Regular.otf');
    const fontData = fs.readFileSync(fontPath);

    // Generate and return the image response with the composed elements
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
            padding: "6px",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundColor: "#101827",
          }}
        >
          {/* Row 1: Challenge Image */}
          <img
            src={`data:image/png;base64,${Buffer.from(challengeImage).toString(
              "base64"
            )}`}
            alt="Challenge image"
            style={{
              width: "500px",
              height: "500px",
              objectFit: "cover",
            }}
          />

          {/* Row 2: Challenge Title */}
          <div
            style={{
              color: "white",
              fontSize: 56,
              fontFamily: "ProtoMono",
              textAlign: "center",
              maxWidth: "1000px",
              marginBottom: "32px",
              fontWeight: 700,
              letterSpacing: "-1px",
            }}
          >
            {challenge.title}
          </div>

          {/* Row 3: Two Columns */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              width: "1000px",
              gap: "40px",
              margin: "0 auto",
              marginBottom: "20px",
            }}
          >
            {/* Left Column: Description */}
            <div
              style={{
                flex: 1,
                color: "white",
                fontSize: 24,
                fontFamily: "ProtoMono",
                textAlign: "left",
                lineHeight: 1.4,
                background: "rgba(30,30,40,0.7)",
                borderRadius: "16px",
                padding: "14px",
                minHeight: "120px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
              }}
            >
              {challenge.description}
            </div>
            {/* Right Column: Activity and Start Date */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                color: "#FBBF24",
                fontSize: 24,
                fontFamily: "ProtoMono",
                background: "rgba(30,30,40,0.7)",
                borderRadius: "16px",
                padding: "14px",
                minHeight: "120px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
              }}
            >
              <div style={{ color: 'violet', fontWeight: 700, marginBottom: 12 }}>Activity:</div>
              <div style={{ color: 'white', marginBottom: 24 }}>{challenge.activity_type}</div>
              <div style={{ color: 'violet', fontWeight: 700, marginBottom: 12 }}>Start date:</div>
              <div style={{ color: 'white' }}>{startDate}</div>
            </div>
          </div>

          {/* Logo */}
          <img
            src={`data:image/png;base64,${Buffer.from(logoImage).toString(
              "base64"
            )}`}
            alt="LivMore logo"
            style={{
              width: "140px",
              position: "absolute",
              top: "20px",
              right: "20px",
              borderRadius: "10px",
            }}
          />
        </div>
      ),
      {
        ...size,
        fonts: [
          {
            name: "ProtoMono",
            data: fontData,
            style: "normal",
          },
        ],
      }
    );
  } catch (e) {
    console.log(`Failed to generate challenge share image`, e);
    return new Response(`Failed to generate challenge share image`, {
      status: 500,
    });
  }
}