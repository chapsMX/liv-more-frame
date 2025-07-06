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
  const imageUrl = new URL(`${appUrl}/api/sharegoal/${id}`);

  const frame = {
    version: "next",
    imageUrl: imageUrl.toString(),
    button: {
      title: "Join Liv More & set yours!",
      action: {
        type: "launch_frame",
        name: "Join me",
        url: appUrl,
        splashImageUrl: `${appUrl}/images/splash.png`,
        splashBackgroundColor: "#101827",
      },
    },
  };

  return {
    title: "Join Liv More & set yours!",
    openGraph: {
      title: "Join Liv More & set yours!",
      description: "Join me🚀",
      images: [{ url: imageUrl.toString() }],
    },
    other: {
      "fc:frame": JSON.stringify(frame),
    },
  };
}

export default async function ShareGoals() {
  return <App />;
}