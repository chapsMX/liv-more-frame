"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { sdk } from "@farcaster/miniapp-sdk";
import type { Context } from "@farcaster/miniapp-core";
import { AddMiniApp } from "@farcaster/miniapp-core";
import { protoMono } from "../styles/fonts";
import { Boton } from "../styles/ui/boton";

type NeynarUser = {
  fid: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
  custody_address?: string;
};

/** Provider from 2026_users (device connection) */
type DeviceProvider = "garmin" | "polar" | null;

export default function ControlPanel() {
  const [context, setContext] = useState<Context.MiniAppContext | null>(null);
  const [neynarUser, setNeynarUser] = useState<NeynarUser | null>(null);
  const [added, setAdded] = useState(false);
  const [notificationDetails, setNotificationDetails] = useState<{ token?: string; url?: string } | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOg, setIsOg] = useState(false);
  const [deviceProvider, setDeviceProvider] = useState<DeviceProvider>(null);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

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
          try {
            const res = await fetch(`/api/user?fid=${ctx.user.fid}`);
            const data = await res.json();
            if (mounted && data.success && data.user) {
              if (data.user.og) setIsOg(true);
              setDeviceProvider(data.user.provider ?? null);
            }
          } catch {
            // ignore; user may not exist yet
          }
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
      } catch (e) {
        console.error("ControlPanel: SDK context error", e);
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

  const handleDisconnectDevice = async () => {
    if (!context?.user?.fid) return;
    setDisconnectError(null);
    setDisconnectLoading(true);
    try {
      const res = await fetch("/api/user/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid: context.user.fid }),
      });
      const data = await res.json();
      if (data.success) {
        setDeviceProvider(null);
      } else {
        setDisconnectError(data.error ?? "Error disconnecting device from provider connection");
      }
    } catch (e) {
      setDisconnectError(e instanceof Error ? e.message : "Error disconnecting device from provider connection in user table");
    } finally {
      setDisconnectLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-black text-white flex flex-col ${protoMono.className}`}>
      <header className="flex items-center justify-between p-3 border-b border-gray-800">
        <Link
          href="/"
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          ← Back
        </Link>
        <h1 className={`text-lg font-semibold ${protoMono.className}`}>Control Panel</h1>
        <div className="w-12" />
      </header>
      <main className="flex-1 p-4">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin" />
            <p className={`text-gray-500 text-sm ${protoMono.className}`}>Loading...</p>
          </div>
        ) : (
          <>
            {/* User info (from Neynar or SDK context) */}
            <section className="w-full max-w-sm space-y-2">
              <h2 className={`text-sm font-semibold text-gray-500 uppercase tracking-wide ${protoMono.className}`}>
                User
              </h2>
              {context?.user ? (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-gray-900 border border-gray-800">
                  {(neynarUser?.pfp_url ?? context?.user?.pfpUrl) ? (
                    <Image
                      src={neynarUser?.pfp_url ?? context?.user?.pfpUrl ?? ""}
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
                    <p className={`font-semibold flex items-center gap-1 min-w-0 ${protoMono.className}`}>
                      <span className="truncate">{neynarUser?.display_name ?? context?.user?.displayName ?? neynarUser?.username ?? context?.user?.username ?? `FID ${context?.user?.fid ?? "—"}`}</span>
                      {isOg && <span className="shrink-0" aria-label="OG">👑</span>}
                    </p>
                    <p className={`text-gray-500 text-xs truncate ${protoMono.className}`}>
                      @{neynarUser?.username ?? context?.user?.username ?? "—"}
                    </p>
                    <p className={`text-gray-500 text-xs mt-0.5 ${protoMono.className}`}>
                      FID: {context?.user?.fid ?? "—"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className={`text-gray-500 text-sm ${protoMono.className}`}>No user found. Open from the miniapp.</p>
              )}
            </section>

            {/* Wallet */}
            <section className="w-full max-w-sm space-y-2 mt-6">
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

            {/* Miniapp and notifications */}
            <section className="w-full max-w-sm space-y-2 mt-6">
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

            {/* Device connection (from 2026_users.provider) */}
            <section className="w-full max-w-sm space-y-2 mt-6">
              <h2 className={`text-sm font-semibold text-gray-500 uppercase tracking-wide ${protoMono.className}`}>
                Device
              </h2>
              {deviceProvider ? (
                <div className="space-y-2">
                  <div className={`p-2 rounded-xl bg-gray-900 border border-gray-800 text-sm text-gray-300 ${protoMono.className}`}>
                    Connected: <span className="capitalize">{deviceProvider}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Boton
                      onClick={handleDisconnectDevice}
                      disabled={disconnectLoading}
                      className="w-full py-2 bg-red-900/50 border-red-700 hover:bg-red-900/70"
                    >
                      {disconnectLoading ? "Disconnecting…" : `Disconnect ${deviceProvider === "garmin" ? "Garmin" : "Polar"}`}
                    </Boton>
                    {deviceProvider === "garmin" && (
                      <a
                        href="https://connect.garmin.com/managerConnections"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-center text-sm text-gray-400 hover:text-white underline ${protoMono.className}`}
                      >
                        Manage on Garmin
                      </a>
                    )}
                  </div>
                  {disconnectError && (
                    <p className={`text-red-400 text-xs ${protoMono.className}`}>{disconnectError}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className={`text-sm text-gray-500 ${protoMono.className}`}>No device connected</p>
                  <Link
                    href="/"
                    className="block w-full"
                  >
                    <Boton className="w-full py-2">
                      Connect device (Garmin or Polar)
                    </Boton>
                  </Link>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
