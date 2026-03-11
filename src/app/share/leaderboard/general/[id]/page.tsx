import App from "@/app/app";
import { Metadata } from "next";

const appUrl = process.env.NEXT_PUBLIC_URL?.replace(/\/+$/, "") ?? "";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  const imageUrl = `${appUrl}/api/img-general/${id}`;

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
    title: "LivMore Weekly Leaderboard",
    openGraph: {
      title: "LivMore Weekly Leaderboard",
      description: "One step at a time. Join the challenge!",
      images: [{ url: imageUrl }],
    },
    other: {
      "fc:frame": JSON.stringify(frame),
    },
  };
}

export default async function ShareLeaderboardGeneral() {
  return <App />;
}
