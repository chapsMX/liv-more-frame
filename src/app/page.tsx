import { Metadata } from "next";
import App from "./app";

const appUrl = process.env.NEXT_PUBLIC_URL;

const frame = {
  version: "next",
  imageUrl: `${appUrl}/newHerorect.png`,
  button: {   
    title: "LivMore 2.0",
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
      description: "Tracking your healthy habits",
    },
    other: {
      "fc:frame": JSON.stringify(frame),
      "base:app_id": "6980f8191672d70694e29334",
    },
  };
}

export default function Home() {
  return (<App />);
}