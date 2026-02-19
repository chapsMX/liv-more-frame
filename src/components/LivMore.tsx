"use client";

import { useEffect, useState, useCallback } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import type { Context } from "@farcaster/miniapp-core";
import { AddMiniApp } from "@farcaster/miniapp-core";
import Image from "next/image";
import { Boton } from "../styles/ui/boton";
import { protoMono } from "../styles/fonts";

type NeynarUser = {
  fid: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
  custody_address?: string;
};

export default function LivMore() {
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
        setAddError("Rechazado por el usuario");
      } else if (e instanceof AddMiniApp.InvalidDomainManifest) {
        setAddError("Manifest de dominio inválido");
      } else {
        setAddError(e instanceof Error ? e.message : "Error al añadir miniapp");
      }
    }
  };

  const handleConnectWallet = async () => {
    setWalletError(null);
    try {
      const provider = await sdk.wallet.getEthereumProvider();
      if (!provider) {
        setWalletError("No hay proveedor de billetera disponible");
        return;
      }
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (accounts?.[0]) {
        setWalletAddress(accounts[0]);
      } else {
        setWalletError("No se obtuvo ninguna cuenta");
      }
    } catch (e) {
      setWalletError(e instanceof Error ? e.message : "Error al conectar billetera");
    }
  };

  if (!sdkReady || isLoading) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin" />
          <p className={protoMono.className}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
        <Image
          src="/livMore_w.png"
          alt="Liv More"
          width={120}
          height={120}
          priority
        />

        <h1 className={`text-2xl font-bold ${protoMono.className}`}>Liv More</h1>
        <p className="text-gray-400 text-center text-sm max-w-sm">
          Gamifying wellness with wearables, blockchain attestations and social challenges.
        </p>

        {/* User info (from Neynar or SDK context) */}
        <section className="w-full max-w-sm space-y-2">
          <h2 className={`text-sm font-semibold text-gray-500 uppercase tracking-wide ${protoMono.className}`}>
            Usuario
          </h2>
          {context?.user && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-gray-800">
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
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 text-sm">
                  ?
                </div>
              )}
              <div className="min-w-0">
                <p className={`font-semibold truncate ${protoMono.className}`}>
                  {neynarUser?.display_name ?? context.user.displayName ?? neynarUser?.username ?? context.user.username ?? `FID ${context.user.fid}`}
                </p>
                <p className="text-gray-500 text-xs truncate">
                  @{neynarUser?.username ?? context.user.username ?? "—"}
                </p>
                {neynarUser?.custody_address && (
                  <p className="text-gray-600 text-xs truncate mt-0.5" title={neynarUser.custody_address}>
                    {neynarUser.custody_address.slice(0, 6)}…{neynarUser.custody_address.slice(-4)}
                  </p>
                )}
              </div>
            </div>
          )}
          {!context?.user && (
            <p className="text-gray-500 text-sm">No hay usuario de Farcaster en este contexto.</p>
          )}
        </section>

        {/* Wallet */}
        <section className="w-full max-w-sm space-y-2">
          <h2 className={`text-sm font-semibold text-gray-500 uppercase tracking-wide ${protoMono.className}`}>
            Billetera
          </h2>
          {walletAddress ? (
            <div className="p-3 rounded-xl bg-gray-900 border border-gray-800 break-all text-sm text-gray-300">
              {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
            </div>
          ) : (
            <Boton onClick={handleConnectWallet} className="w-full py-3">
              Conectar billetera
            </Boton>
          )}
          {walletError && <p className="text-red-400 text-xs">{walletError}</p>}
        </section>

        {/* Install miniapp + notifications */}
        <section className="w-full max-w-sm space-y-2">
          <h2 className={`text-sm font-semibold text-gray-500 uppercase tracking-wide ${protoMono.className}`}>
            Miniapp y notificaciones
          </h2>
          {added ? (
            <div className="p-3 rounded-xl bg-gray-900 border border-gray-800 text-sm text-gray-300">
              Miniapp instalada
              {notificationDetails?.token && (
                <p className="text-xs text-gray-500 mt-1">Notificaciones habilitadas</p>
              )}
            </div>
          ) : (
            <Boton onClick={handleAddMiniApp} className="w-full py-3">
              Instalar miniapp y habilitar notificaciones
            </Boton>
          )}
          {addError && <p className="text-red-400 text-xs">{addError}</p>}
        </section>

        {/* Placeholder for the full app */}
        <section className="w-full max-w-sm mt-4 p-6 rounded-xl border-2 border-dashed border-gray-700 text-center">
          <p className={`text-gray-500 text-sm ${protoMono.className}`}>
            Placeholder — La app completa se construirá aquí.
          </p>
        </section>
      </main>

      <footer className="w-full py-4 text-center">
        <p className="text-gray-500 text-sm">
          built with <span className="text-red-500">❤</span> during ETH Denver
        </p>
      </footer>
    </div>
  );
}
