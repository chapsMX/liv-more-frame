import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { OG_ABI, OG_CONTRACT_ADDRESS } from "@/lib/og-contract";

const APP_URL = process.env.NEXT_PUBLIC_URL?.replace(/\/+$/, "") ?? "";

function ensureAbsolute(path: string): string {
  return `${APP_URL}${path}`;
}

function parseFid(rawFid: string): number | null {
  const n = Number(rawFid);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

async function getShareMintData(fid: number): Promise<{ fid: number } | null> {
  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });
    const minted = await publicClient.readContract({
      address: OG_CONTRACT_ADDRESS,
      abi: OG_ABI,
      functionName: "isFidMinted",
      args: [BigInt(fid)],
    });
    return minted ? { fid } : null;
  } catch {
    return null;
  }
}

export type ShareMintPageProps = {
  params: Promise<{ fid: string }>;
};

export async function generateMetadata({
  params,
}: ShareMintPageProps): Promise<Metadata> {
  const { fid: rawFid } = await params;
  const fid = parseFid(rawFid);
  if (fid === null) {
    notFound();
  }
  const data = await getShareMintData(fid);
  if (!data) {
    notFound();
  }

  const shareUrl = `${APP_URL}/share-mint/${fid}`;
  const shareImageUrl = `${APP_URL}/imagen/${fid}`;
  const frame = {
    version: "next",
    imageUrl: shareImageUrl,
    button: {
      title: "Mint LivMore OG",
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
    title: `LivMore OG #${fid}`,
    description: "One step at a time.",
    openGraph: {
      type: "website",
      url: shareUrl,
      title: `LivMore OG #${fid}`,
      description: "One step at a time.",
      images: [{ url: shareImageUrl }],
    },
    other: {
      "fc:frame": JSON.stringify(frame),
    },
  };
}

export default async function ShareMintPage({ params }: ShareMintPageProps) {
  const { fid: rawFid } = await params;
  const fid = parseFid(rawFid);
  if (fid === null) {
    notFound();
  }
  const data = await getShareMintData(fid);
  if (!data) {
    notFound();
  }

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
{/*       <h1 style={{ margin: 0, fontSize: 24 }}>LivMore OG #{data.fid}</h1>
      <p style={{ margin: 0, maxWidth: 360, color: "#9ca3af" }}>
        Tracking your healthy habits, one step at a time.
      </p>
      <a
        href={APP_URL}
        style={{
          display: "inline-block",
          marginTop: 8,
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
      </a> */}
    </main>
  );
}
