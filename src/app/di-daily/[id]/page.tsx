import App from "@/app/app";
import { Metadata } from "next";

const appUrl = process.env.NEXT_PUBLIC_URL;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  /* const imageUrl = new URL(`${appUrl}/api/og/${id}`); */
  const imageUrl = new URL(`https://app.livmore.life/api/sharedaily/${id}`);

  const frame = {
    version: "next",
    imageUrl: imageUrl.toString(),
    button: {
      title: "I completed my daily goals!",
      action: {
        type: "launch_frame",
        name: "Can you beat me?",
        url: appUrl,
        splashImageUrl: `${appUrl}/images/splash.png`,
        splashBackgroundColor: "#101827",
      },
    },
  };

  return {
    title: "LivMore",
    openGraph: {
      title: "LivMore",
      description: "Turn Healty Habitos Into Rewards",
      images: [{ url: imageUrl.toString() }],
    },
    other: {
      "fc:frame": JSON.stringify(frame),
    },
  };
}

export default async function ShareDaily() {
  return <App />;
}