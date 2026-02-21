"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { sdk } from "@farcaster/miniapp-sdk";
import type { Context } from "@farcaster/miniapp-core";
import { AddMiniApp } from "@farcaster/miniapp-core";
import Image from "next/image";
import { Boton } from "../styles/ui/boton";
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
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [notificationDetails, setNotificationDetails] = useState<{ token?: string; url?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sdkReady, setSdkReady] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);

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
        if (ctx.client.notificationDetails) {
          setNotificationDetails(ctx.client.notificationDetails);
        }
        if (ctx.user?.fid) {
          await fetchNeynarUser(ctx.user.fid);
        }

        sdk.on("miniAppAdded", ({ notificationDetails: details }) => {
          setAdded(true);
          if (details) setNotificationDetails(details);
          setAddError(null);
        });
        sdk.on("miniAppAddRejected", ({ reason }) => {
          setAddError(reason === "rejected_by_user" ? "Añadir miniapp rechazado" : "Error de manifest");
        });
        sdk.on("miniAppRemoved", () => {
          setAdded(false);
          setNotificationDetails(null);
        });
        sdk.on("notificationsEnabled", ({ notificationDetails: details }) => {
          if (details) setNotificationDetails(details);
        });
        sdk.on("notificationsDisabled", () => {
          setNotificationDetails(null);
        });

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

  const handleAddMiniApp = async () => {
    setAddError(null);
    try {
      const result = await sdk.actions.addMiniApp();
      if (result.notificationDetails) {
        setNotificationDetails(result.notificationDetails);
        setAdded(true);
      }
    } catch (e) {
      if (e instanceof AddMiniApp.RejectedByUser) {
        setAddError("Rejected by user");
      } else if (e instanceof AddMiniApp.InvalidDomainManifest) {
        setAddError("Invalid domain manifest");
      } else {
        setAddError(e instanceof Error ? e.message : "Error adding miniapp");
      }
    }
  };

  const handleConnectWallet = async () => {
    setWalletError(null);
    try {
      const provider = await sdk.wallet.getEthereumProvider();
      if (!provider) {
        setWalletError("No wallet provider available");
        return;
      }
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (accounts?.[0]) {
        setWalletAddress(accounts[0]);
      } else {
        setWalletError("No account found");
      }
    } catch (e) {
      setWalletError(e instanceof Error ? e.message : "Error connecting wallet");
    }
  };

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

        {/* User info (from Neynar or SDK context) */}
        <section className="w-full max-w-sm space-y-2">
          <h2 className={`text-sm font-semibold text-gray-500 uppercase tracking-wide ${protoMono.className}`}>
            User:
          </h2>
          {context?.user && (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-gray-900 border border-gray-800">
              {(neynarUser?.pfp_url ?? context.user.pfpUrl) ? (
                <Image
                  src={neynarUser?.pfp_url ?? context.user.pfpUrl ?? ""}
                  alt="Avatar"
                  width={40}
                  height={40}
                  className="rounded-full border border-gray-700"
                  unoptimized
                />
              ) : (
                <div className={`w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 text-sm ${protoMono.className}`}>
                  ?
                </div>
              )}
              <div className="min-w-0">
                <p className={`font-semibold truncate ${protoMono.className}`}>
                  {neynarUser?.display_name ?? context.user.displayName ?? neynarUser?.username ?? context.user.username ?? `FID ${context.user.fid}`}
                </p>
                <p className={`text-gray-500 text-xs truncate ${protoMono.className}`}>
                  @{neynarUser?.username ?? context.user.username ?? "—"}
                </p>
              </div>
            </div>
          )}
          {!context?.user && (
            <p className={`text-gray-500 text-sm ${protoMono.className}`}>No user found in this context.</p>
          )}
        </section>

        {/* Wallet */}
        <section className="w-full max-w-sm space-y-2">
          <h2 className={`text-sm font-semibold text-gray-500 uppercase tracking-wide ${protoMono.className}`}>
            Wallet
          </h2>
          {walletAddress ? (
            <div className={`p-2 rounded-xl bg-gray-900 border border-gray-800 break-all text-sm text-gray-300 ${protoMono.className}`}>
              {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
            </div>
          ) : (
            <Boton onClick={handleConnectWallet} className="w-full py-2">
              Connect wallet
            </Boton>
          )}
          {walletError && <p className={`text-red-400 text-xs ${protoMono.className}`}>{walletError}</p>}
        </section>

        {/* Install miniapp + notifications */}
        <section className="w-full max-w-sm space-y-2">
          <h2 className={`text-sm font-semibold text-gray-500 uppercase tracking-wide ${protoMono.className}`}>
            Miniapp and notifications
          </h2>
          {added ? (
            <div className={`p-2 rounded-xl bg-gray-900 border border-gray-800 text-sm text-gray-300 ${protoMono.className}`}>
              Miniapp installed
              {notificationDetails?.token && (
                <p className={`text-xs text-gray-500 mt-1 ${protoMono.className}`}>Notifications enabled</p>
              )}
            </div>
          ) : (
            <Boton onClick={handleAddMiniApp} className="w-full py-2">
              Install miniapp and enable notifications
            </Boton>
          )}
          {addError && <p className={`text-red-400 text-xs ${protoMono.className}`}>{addError}</p>}
        </section>

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
