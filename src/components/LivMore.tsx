"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { sdk } from "@farcaster/miniapp-sdk";
import type { Context } from "@farcaster/miniapp-core";
import { AddMiniApp } from "@farcaster/miniapp-core";
import Image from "next/image";
import { protoMono } from "../styles/fonts";

function HamburgerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

type NeynarUser = {
  fid: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
  custody_address?: string;
};

export default function LivMore() {
  const router = useRouter();
  const [context, setContext] = useState<Context.MiniAppContext | null>(null);
  const [neynarUser, setNeynarUser] = useState<NeynarUser | null>(null);
  const [added, setAdded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sdkReady, setSdkReady] = useState(false);
  const hasAutoPromptedAddMiniAppRef = useRef(false);

  const fetchNeynarUser = useCallback(async (fid: number) => {
    try {
      const res = await fetch(`/api/neynar?fid=${fid}`);
      const data = await res.json();
      if (data.success && data.user) {
        setNeynarUser(data.user);
      }
    } catch (e) {
      console.error("Error fetching Neynar user:", e);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const ctx = await sdk.context;
        if (!mounted) return;
        setContext(ctx);
        setAdded(ctx.client.added);
        if (ctx.user?.fid) {
          await fetchNeynarUser(ctx.user.fid);
        }

        sdk.on("miniAppAdded", () => {
          setAdded(true);
        });
        sdk.on("miniAppAddRejected", () => {
          // Rejected or manifest error; Control Panel shows status if user navigates there
        });
        sdk.on("miniAppRemoved", () => {
          setAdded(false);
        });
        sdk.on("notificationsEnabled", () => {});
        sdk.on("notificationsDisabled", () => {});

        await sdk.actions.ready({});
        if (mounted) setSdkReady(true);
      } catch (e) {
        console.error("SDK init error:", e);
        if (mounted) setSdkReady(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
      sdk.removeAllListeners();
    };
  }, [fetchNeynarUser]);

  // Auto-open add miniapp menu when not added (like buttlet.tsx)
  useEffect(() => {
    if (!sdkReady || added || hasAutoPromptedAddMiniAppRef.current) return;
    hasAutoPromptedAddMiniAppRef.current = true;
    sdk.actions
      .addMiniApp()
      .then(() => {
        setAdded(true);
      })
      .catch((e: unknown) => {
        if (e instanceof AddMiniApp.RejectedByUser) {
          return;
        }
        // On other errors, user can retry from Control Panel
      });
  }, [sdkReady, added]);

  if (!sdkReady || isLoading) {
    return (
      <div className={`min-h-screen bg-black text-white flex items-center justify-center ${protoMono.className}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin" />
          <p className={protoMono.className}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-black text-white flex flex-col ${protoMono.className}`}>
      {/* Top bar: menu pill (profile + hamburger) top right */}
      <header className="flex justify-end items-center p-2 pr-3 shrink-0 border-b border-gray-800">
        <button
          type="button"
          onClick={() => router.push("/control-panel")}
          className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-gray-900 border border-gray-700 hover:bg-gray-800 hover:border-gray-600 transition-colors"
          aria-label="Open menu"
        >
          {(neynarUser?.pfp_url ?? context?.user?.pfpUrl) ? (
            <Image
              src={neynarUser?.pfp_url ?? context?.user?.pfpUrl ?? ""}
              alt="Profile"
              width={28}
              height={28}
              className="rounded-full border border-gray-600 shrink-0"
              unoptimized
            />
          ) : (
            <div className={`w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 text-xs shrink-0 ${protoMono.className}`}>
              ?
            </div>
          )}
          <HamburgerIcon className="text-gray-400 shrink-0" />
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-2 gap-2">
        <Image
          src="/livMore_w.png"
          alt="Liv More"
          width={80}
          height={80}
          priority
        />
        <h1 className={`text-2xl font-bold ${protoMono.className}`}>LivMore</h1>
        <p className={`text-gray-400 text-center text-sm max-w-sm ${protoMono.className}`}>
          Tracking your healthy habits 👟👟👟 
        </p>

        {/* Placeholder for the full app */}
        <section className="w-full max-w-sm mt-4 p-2 rounded-xl border-2 border-dashed border-gray-700 text-center">
          <p className={`text-gray-500 text-sm ${protoMono.className}`}>
            <strong className="text-gray-400">Wen token:</strong> Soon, via Clanker
          </p>
          <p className={`text-gray-500 text-sm mt-1 ${protoMono.className}`}>
            <strong className="text-gray-400">Supported Devices:</strong> Garmin, Polar
          </p>
          <p className={`text-gray-500 text-sm mt-1 ${protoMono.className}`}>
            <strong className="text-gray-400">What:</strong> 👟👟👟
          </p>
        </section>
      </main>

      <footer className="w-full py-4 text-center">
        <p className={`text-gray-500 text-sm ${protoMono.className}`}>
          built with <span className="text-red-500">❤</span> during ETH Denver
        </p>
      </footer>
    </div>
  );
}
