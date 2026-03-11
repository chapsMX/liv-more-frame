import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getAttestShareData,
  formatDateDisplay,
} from "@/lib/attest-share";

const APP_URL = process.env.NEXT_PUBLIC_URL?.replace(/\/+$/, "") ?? "";

function ensureAbsolute(path: string): string {
  return `${APP_URL}${path}`;
}

function parseFid(rawFid: string): number | null {
  const n = Number(rawFid);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function parseDate(rawDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return null;
  return rawDate;
}

export type ShareAttestPageProps = {
  params: Promise<{ fid: string; date: string }>;
};

export async function generateMetadata({
  params,
}: ShareAttestPageProps): Promise<Metadata> {
  const { fid: rawFid, date: rawDate } = await params;
  const fid = parseFid(rawFid);
  const date = parseDate(rawDate);
  if (fid === null || date === null) notFound();

  const data = await getAttestShareData(fid, date);
  if (!data) notFound();

  const shareUrl = `${APP_URL}/share-attest/${fid}/${date}`;
  const shareImageUrl = `${APP_URL}/imagen/attest/${fid}/${date}`;
  const displayName = data.displayName || data.username || `@${data.fid}`;
  const title = `${displayName} attested ${data.steps.toLocaleString()} steps on LivMore`;
  const description = `One step at a time. ${formatDateDisplay(date)}`;

  const frame = {
    version: "next",
    imageUrl: shareImageUrl,
    button: {
      title: "Open LivMore",
      action: {
        type: "launch_frame",
        name: "LivMore",
        url: APP_URL,
        splashImageUrl: ensureAbsolute("/splash.png"),
        splashBackgroundColor: "#05050F",
      },
    },
  };

  return {
    ...(APP_URL && { metadataBase: new URL(APP_URL) }),
    title,
    description,
    openGraph: {
      type: "website",
      url: shareUrl,
      title,
      description,
      images: [{ url: shareImageUrl }],
    },
    other: {
      "fc:frame": JSON.stringify(frame),
    },
  };
}

export default async function ShareAttestPage({ params }: ShareAttestPageProps) {
  const { fid: rawFid, date: rawDate } = await params;
  const fid = parseFid(rawFid);
  const date = parseDate(rawDate);
  if (fid === null || date === null) notFound();

  const data = await getAttestShareData(fid, date);
  if (!data) notFound();

  const displayName = data.displayName || data.username || `User #${fid}`;
  const attestUrl = `https://base.easscan.org/attestation/view/${data.attestationHash}`;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        fontFamily: "monospace",
        textAlign: "center",
        background: "#000",
        color: "#fff",
      }}
    >
      <h1 style={{ margin: 0, fontSize: 22 }}>
        {displayName} attested {data.steps.toLocaleString()} steps
      </h1>
      <p style={{ margin: 0, color: "#9ca3af" }}>
        {formatDateDisplay(data.date)} · LivMore
      </p>
      <a
        href={attestUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          marginTop: 8,
          color: "#ff8800",
          textDecoration: "underline",
          fontSize: 14,
        }}
      >
        View attestation on Base
      </a>
      <a
        href={APP_URL}
        style={{
          display: "inline-block",
          marginTop: 16,
          padding: "10px 20px",
          borderRadius: 8,
          background: "#1f2937",
          color: "#fff",
          textDecoration: "none",
          fontWeight: 600,
          border: "1px solid #4b5563",
        }}
      >
        Open LivMore
      </a>
    </main>
  );
}
