"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { sdk } from "@farcaster/miniapp-sdk";
import type { Context } from "@farcaster/miniapp-core";
import { AddMiniApp } from "@farcaster/miniapp-core";
import Image from "next/image";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { concat, encodeFunctionData } from "viem";
import { base } from "viem/chains";
import { protoMono } from "../styles/fonts";
import { OG_ABI, OG_CONTRACT_ADDRESS, OG_CHAIN_ID } from "../lib/og-contract";
import { DATA_SUFFIX } from "../lib/builder-code";
import { Boton } from "../styles/ui/boton";

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
  const hasEnsuredUserRef = useRef(false);
  const [ogFidMinted, setOgFidMinted] = useState<boolean | null>(null);
  const [ogTokenImageUrl, setOgTokenImageUrl] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const shareBaseUrl = useMemo(() => {
    const envUrl = process.env.NEXT_PUBLIC_URL;
    if (envUrl && envUrl.length > 0) {
      return envUrl.replace(/\/+$/, "");
    }
    if (typeof window !== "undefined" && window.location?.origin) {
      return window.location.origin.replace(/\/+$/, "");
    }
    return "";
  }, []);

  const fetchNeynarUser = useCallback(async (fid: number): Promise<NeynarUser | null> => {
    try {
      const res = await fetch(`/api/neynar?fid=${fid}`);
      const data = await res.json();
      if (data.success && data.user) {
        setNeynarUser(data.user);
        return data.user;
      }
    } catch (e) {
      console.error("Error fetching Neynar user:", e);
    }
    return null;
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
          const neynarData = await fetchNeynarUser(ctx.user.fid);
          if (!mounted) return;
          if (!hasEnsuredUserRef.current) {
            hasEnsuredUserRef.current = true;
            try {
              const res = await fetch("/api/user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  fid: ctx.user.fid,
                  username: neynarData?.username ?? ctx.user.username ?? null,
                  eth_address: neynarData?.custody_address ?? null,
                }),
              });
              const data = await res.json();
              if (!data.success) {
                console.error("[LivMore] ensure user failed:", data.error);
              }
            } catch (e) {
              console.error("[LivMore] ensure user error:", e);
            }
          }
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

  const checkOgMinted = useCallback(async (fid: number) => {
    try {
      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });
      const minted = await publicClient.readContract({
        address: OG_CONTRACT_ADDRESS,
        abi: OG_ABI,
        functionName: "isFidMinted",
        args: [BigInt(fid)],
      });
      setOgFidMinted(minted);
    } catch {
      // Contract may revert or return no data when fid not minted; treat as not minted
      setOgFidMinted(false);
    }
  }, []);

  useEffect(() => {
    if (!sdkReady || !context?.user?.fid) return;
    checkOgMinted(context.user.fid);
  }, [sdkReady, context?.user?.fid, checkOgMinted]);

  useEffect(() => {
    if (ogFidMinted !== true || !context?.user?.fid) return;
    let cancelled = false;
    const fid = context.user.fid;
    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });
    const resolveUrl = (url: string) => {
      if (url.startsWith("ipfs://")) {
        const path = url.replace("ipfs://", "").replace(/^ipfs\//, "");
        return `https://ipfs.io/ipfs/${path}`;
      }
      return url;
    };
    publicClient
      .readContract({
        address: OG_CONTRACT_ADDRESS,
        abi: OG_ABI,
        functionName: "tokenURI",
        args: [BigInt(fid)],
      })
      .then((uri) => {
        if (cancelled || !uri) return;
        if (uri.startsWith("data:application/json;base64,")) {
          try {
            const b64 = uri.slice("data:application/json;base64,".length);
            const jsonStr = atob(b64);
            const data = JSON.parse(jsonStr) as { image?: string };
            if (cancelled) return;
            if (data?.image && data.image.startsWith("data:image")) {
              setOgTokenImageUrl(data.image);
            } else if (data?.image) {
              setOgTokenImageUrl(resolveUrl(data.image));
            } else {
              setOgTokenImageUrl(null);
            }
          } catch {
            if (!cancelled) setOgTokenImageUrl(null);
          }
          return;
        }
        const resolvedUri = resolveUrl(uri);
        fetch(resolvedUri)
          .then((res) => res.json().catch(() => null))
          .then((data) => {
            if (cancelled) return;
            if (data && typeof data.image === "string") {
              setOgTokenImageUrl(resolveUrl(data.image));
            } else {
              setOgTokenImageUrl(resolvedUri);
            }
          })
          .catch(() => {
            if (!cancelled) setOgTokenImageUrl(resolvedUri);
          });
      })
      .catch(() => {
        if (!cancelled) setOgTokenImageUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ogFidMinted, context?.user?.fid]);

  const handleMintOg = useCallback(async () => {
    const fid = context?.user?.fid;
    const username = neynarUser?.username ?? context?.user?.username ?? "";
    if (!fid || !username) {
      setMintError("Missing FID or username");
      return;
    }
    setIsMinting(true);
    setMintError(null);
    try {
      const provider = await sdk.wallet.getEthereumProvider();
      if (!provider) {
        setMintError("Connect your wallet first");
        setIsMinting(false);
        return;
      }
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(provider),
      });
      const publicClient = createPublicClient({
        chain: base,
        transport: custom(provider),
      });
      let minted = false;
      try {
        minted = await publicClient.readContract({
          address: OG_CONTRACT_ADDRESS,
          abi: OG_ABI,
          functionName: "isFidMinted",
          args: [BigInt(fid)],
        });
      } catch {
        // Contract may revert or return no data when fid not minted; treat as not minted
      }
      if (minted) {
        setOgFidMinted(true);
        setMintError(null);
        setIsMinting(false);
        return;
      }
      const account = (await walletClient.getAddresses())?.[0];
      if (!account) {
        setMintError("No wallet address");
        setIsMinting(false);
        return;
      }
      const signRes = await fetch("/api/og-mint/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid, username, recipient: account }),
      });
      const signData = await signRes.json();
      if (!signData.success || !signData.deadline || !signData.signature) {
        setMintError(signData.error ?? "Failed to get mint signature");
        setIsMinting(false);
        return;
      }
      const chainIdHex = `0x${OG_CHAIN_ID.toString(16)}`;
      try {
        const currentChainId = await provider.request({ method: "eth_chainId" });
        if (currentChainId !== chainIdHex) {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: chainIdHex }],
          });
        }
      } catch (switchErr: unknown) {
        const msg = switchErr instanceof Error ? switchErr.message : "Could not switch network";
        setMintError(`Switch to Base first: ${msg}`);
        setIsMinting(false);
        return;
      }
      const hash = await walletClient.sendTransaction({
        to: OG_CONTRACT_ADDRESS,
        data: concat([
          encodeFunctionData({
            abi: OG_ABI,
            functionName: "mint",
            args: [
              BigInt(fid),
              username,
              BigInt(signData.deadline),
              signData.signature as `0x${string}`,
            ],
          }),
          DATA_SUFFIX,
        ]),
        account,
      });
      if (!hash) {
        setMintError("Mint transaction failed");
        setIsMinting(false);
        return;
      }
      setOgFidMinted(true);
      await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid, og: true }),
      });
      setShareError(null);
      if (shareBaseUrl && fid) {
        try {
          const shareUrl = `${shareBaseUrl}/share-mint/${fid}`;
          const shareText =
            `I just minted @livmore OG token 👟\n` +
            `Tracking your healthy habits, one step at a time.\n` +
            `Mint yours for free!\n` +
            shareUrl;
          await sdk.actions.composeCast({
            text: shareText,
            embeds: [shareUrl],
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to share";
          setShareError(msg);
        }
      }
    } catch (e) {
      setMintError(e instanceof Error ? e.message : "Mint failed");
    } finally {
      setIsMinting(false);
    }
  }, [context?.user?.fid, context?.user?.username, neynarUser?.username, shareBaseUrl]);

  const handleShareOgMint = useCallback(async () => {
    setShareError(null);
    if (!shareBaseUrl) {
      setShareError("Share URL not configured");
      return;
    }
    const fid = context?.user?.fid;
    if (!fid) {
      setShareError("Missing user fid");
      return;
    }
    try {
      const shareUrl = `${shareBaseUrl}/share-mint/${fid}`;
      const shareText =
      `I just minted @livmore OG token 👟\n` +
      `Tracking your healthy habits, one step at a time.\n` +
      `Mint yours for free!\n` +
        shareUrl;
      await sdk.actions.composeCast({
        text: shareText,
        embeds: [shareUrl],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to share";
      setShareError(msg);
    }
  }, [shareBaseUrl, context?.user?.fid]);

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
          Tracking your healthy habits
        </p>
        <p className={`text-gray-600 text-center text-sm max-w-sm ${protoMono.className}`}>
          👟 One step at a time 👟
        </p>

        {ogFidMinted === true ? (
          <>
            {/* OG NFT image */}
            <section className="w-full max-w-sm mt-2 flex flex-col items-center">
              {ogTokenImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ogTokenImageUrl}
                  alt="OG NFT"
                  className="w-full max-w-[280px] aspect-square object-contain rounded-xl border border-gray-700"
                />
              ) : (
                <div className="w-full max-w-[280px] aspect-square rounded-xl border border-gray-700 bg-gray-900 flex items-center justify-center text-gray-500 text-sm">
                  Loading NFT…
                </div>
              )}
{/*               {context?.user?.fid != null && (
                <p className={`text-gray-500 text-sm mt-2 ${protoMono.className}`}>
                  FID {context.user.fid}
                </p>
              )} */}
              <p className={`text-gray-400 text-center text-sm mt-1 max-w-sm ${protoMono.className}`}>
                Extra perks are coming your way!
              </p>
              <Boton onClick={handleShareOgMint} className="w-full max-w-sm mt-2 py-2">
                Share OG mint
              </Boton>
              {shareError && <p className={`text-amber-400 text-xs mt-1 ${protoMono.className}`}>{shareError}</p>}
            </section>
          </>
        ) : (
          <section className="w-full max-w-sm space-y-2 mt-2">
            <h2 className={`text-sm font-semibold text-gray-500 uppercase tracking-wide ${protoMono.className}`}>
              OG Token
            </h2>
            <p className={`text-gray-500 text-xs ${protoMono.className}`}>
              Mint your free OG NFT on Base.
            </p>
            <Boton
              onClick={handleMintOg}
              disabled={isMinting}
              className="w-full py-2"
            >
              {isMinting ? "Minting…" : "Mint OG & Share"}
            </Boton>
            {mintError && <p className={`text-red-400 text-xs ${protoMono.className}`}>{mintError}</p>}
            {shareError && <p className={`text-amber-400 text-xs ${protoMono.className}`}>{shareError}</p>}
          </section>
        )}

        {/* FAQs */}
        <section className={`w-full max-w-sm mt-4 p-4 rounded-xl border-2 border-dashed border-gray-600 bg-black ${protoMono.className}`}>
          <p className="text-sm text-gray-400">Wen token: Soon, via Clanker</p>
          <p className="text-sm text-gray-400">Supported Devices: Garmin, Polar</p>
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
