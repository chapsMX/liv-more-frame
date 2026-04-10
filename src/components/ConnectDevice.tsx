"use client";

import Image from "next/image";
import { sdk } from "@farcaster/miniapp-sdk";
import { protoMono } from "@/styles/fonts";
import type { AppUser } from "@/types/user";

type ConnectDeviceProps = {
  user: AppUser;
  onProviderSet?: () => void;
};

async function openAuthUrl(path: string) {
  const url = `${window.location.origin}${path}`;
  try {
    await sdk.actions.openUrl(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export default function ConnectDevice({ user }: ConnectDeviceProps) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-2 gap-2 overflow-auto">
      <div className="flex flex-row items-center justify-center w-full max-w-sm gap-4">
        <div className="flex flex-1 items-center justify-center">
          <Image
            src="/livMore_w.png"
            alt="Liv More"
            width={80}
            height={80}
            priority
          />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <h1 className={`text-3xl font-bold ${protoMono.className}`}>LivMore</h1>
        </div>
      </div>
      <p className={`text-gray-400 text-center text-base max-w-sm ${protoMono.className}`}>
        Connect your device to track steps
      </p>
      <p className={`text-gray-600 text-center text-sm max-w-sm ${protoMono.className}`}>
        Choose your wearable to get started.
      </p>

      {user.provider === "google" && (
        <p className={`text-amber-400/90 text-center text-sm max-w-sm border border-amber-500/40 rounded-lg px-3 py-2 ${protoMono.className}`}>
          Google Fit is no longer available. Connect Garmin, Polar, or Oura to keep tracking your steps.
        </p>
      )}

      <section className="w-full max-w-sm mt-4 space-y-3">
        <h2 className={`text-sm font-semibold text-gray-500 uppercase tracking-wide ${protoMono.className}`}>
          Connect device
        </h2>
        <button
          type="button"
          onClick={() => openAuthUrl(`/api/auth/garmin-v1?fid=${user.fid}`)}
          className="flex items-center justify-center gap-2 px-4 py-2 w-full bg-transparent border-2 border-[#ff8800] text-[#ff8800] hover:bg-[#ff8800] hover:text-white rounded-full min-w-[80px] transition-colors"
        >
          Connect Garmin
        </button>
        <button
          type="button"
          onClick={() => openAuthUrl(`/api/auth/polar?fid=${user.fid}`)}
          className="flex items-center justify-center gap-2 px-4 py-2 w-full bg-transparent border-2 border-[#d4003c] text-[#d4003c] hover:bg-[#d4003c] hover:text-white rounded-full min-w-[80px] transition-colors"
        >
          Connect Polar
        </button>
        <button
          type="button"
          onClick={() => openAuthUrl(`/api/auth/oura/connect?fid=${user.fid}`)}
          className="flex items-center justify-center gap-2 px-4 py-2 w-full bg-transparent border-2 border-[#00d4aa] text-[#00d4aa] hover:bg-[#00d4aa] hover:text-white rounded-full min-w-[80px] transition-colors"
        >
          Connect Oura
        </button>
        <p className={`text-gray-600 text-xs text-center mt-2 ${protoMono.className}`}>
          Both connections open in your browser. Once connected, close the browser window, return to the miniapp and refresh it.
        </p>
        <p className={`text-gray-600 text-xs text-center mt-1 ${protoMono.className}`}>
          Account FID: {user.fid}
        </p>
      </section>
    </main>
  );
}
