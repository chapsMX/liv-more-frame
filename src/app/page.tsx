import { Metadata } from "next";
import App from "./app";

const appUrl = process.env.NEXT_PUBLIC_URL;

const frame = {
  version: "next",
  imageUrl: `${appUrl}/frameImage.png`,
  button: {   
    title: "Climb the activity leaderboard!",
    action: {
      type: "launch_frame",
      name: "Liv More",
      url: appUrl,
      splashImageUrl: `${appUrl}/splash.png`,
      splashBackgroundColor: "#101827",
    },
  },
};

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Liv More",
    openGraph: {
      title: "Liv More",
      description: "Turn Healty Habitos Into Rewards",
    },
    other: {
      "fc:frame": JSON.stringify(frame),
    },
  };
}

export default function Home() {
  return (<App />);
}