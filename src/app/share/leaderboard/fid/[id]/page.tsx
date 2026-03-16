import App from "@/app/app";
import { Metadata } from "next";

const appUrl = process.env.NEXT_PUBLIC_URL?.replace(/\/+$/, "") ?? "";

function todayYYYYMMDDHHMMSS(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
}

function isDatePart(s: string): boolean {
  if (/^\d{8}$/.test(s)) {
    return parseInt(s.slice(4, 6), 10) >= 1 && parseInt(s.slice(4, 6), 10) <= 12;
  }
  if (/^\d{14}$/.test(s)) {
    return parseInt(s.slice(4, 6), 10) >= 1 && parseInt(s.slice(4, 6), 10) <= 12;
  }
  return false;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ d?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { d } = await searchParams;

  // Append date (YYYYMMDD) for cache busting; skip if id already ends with date
  const parts = id.split("-");
  const hasDate = parts.length >= 1 && isDatePart(parts[parts.length - 1]);
  const dateParam = hasDate
    ? parts[parts.length - 1]
    : d && /^\d{4}-\d{2}-\d{2}$/.test(d)
      ? d.replace(/-/g, "")
      : todayYYYYMMDDHHMMSS();
  const imageId = hasDate ? id : `${id}-${dateParam}`;
  const imageUrl = `${appUrl}/api/img-fid/${imageId}`;

  const frame = {
    version: "next",
    imageUrl,
    button: {
      title: "Open LivMore",
      action: {
        type: "launch_frame",
        name: "LivMore",
        url: appUrl,
        splashImageUrl: `${appUrl}/splash.png`,
        splashBackgroundColor: "#101827",
      },
    },
  };

  return {
    ...(appUrl && { metadataBase: new URL(appUrl) }),
    title: "LivMore My Position",
    openGraph: {
      title: "LivMore My Position",
      description: "One step at a time. Check my ranking!",
      images: [{ url: imageUrl }],
    },
    other: {
      "fc:frame": JSON.stringify(frame),
    },
  };
}

export default async function ShareLeaderboardFid() {
  return <App />;
}
