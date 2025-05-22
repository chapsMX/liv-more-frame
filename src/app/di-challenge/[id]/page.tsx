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
  const imageUrl = new URL(`${appUrl}/api/sharechallenge/${id}`);

  const frame = {
    version: "next",
    imageUrl: imageUrl.toString(),
    button: {
      title: "I just joined this challenge!",
      action: {
        type: "launch_frame",
        name: "Wanna join me?",
        url: appUrl,
        splashImageUrl: `${appUrl}/images/splash.png`,
        splashBackgroundColor: "#101827",
      },
    },
  };

  return {
    title: "LivMore Challenge",
    openGraph: {
      title: "LivMore Challenge",
      description: "Join me in this challenge!",
      images: [{ url: imageUrl.toString() }],
    },
    other: {
      "fc:frame": JSON.stringify(frame),
    },
  };
}

export default async function ShareChallenge() {
  return <App />;
}