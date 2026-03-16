"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { sdk } from "@farcaster/miniapp-sdk";
import type { Context } from "@farcaster/miniapp-core";
import { AddMiniApp } from "@farcaster/miniapp-core";
import { EAS } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";
import { HybridSigner } from "@/lib/hybrid-signer";
import Image from "next/image";
import { protoMono } from "../styles/fonts";
import { Boton } from "../styles/ui/boton";
import type { AppUser } from "@/types/user";
import ConnectDevice from "./ConnectDevice";
import Leaderboard from "./Leaderboard";
import Steps from "./Steps";
import OG from "./OG";

type TabId = "home" | "leaderboard" | "steps" | "og";

const EAS_CONTRACT = "0x4200000000000000000000000000000000000021";
const BASE_RPC = "https://mainnet.base.org";

/** Returns today's date in UTC as YYYY-MM-DD */
function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns yesterday's date in UTC as YYYY-MM-DD */
function getYesterdayUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Returns from (9 days before today) and to (today) in UTC YYYY-MM-DD. Includes today. */
function getLast10DaysRange(): { from: string; to: string } {
  const to = getTodayUTC();
  const d = new Date(to + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 9);
  const from = d.toISOString().slice(0, 10);
  return { from, to };
}

/** Format YYYY-MM-DD as "Mon 09 March" (short day, day, month) */
function formatDateDayWeekMonth(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.includes("T") ? "" : "T12:00:00Z"));
  const dayOfWeek = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const day = d.getUTCDate();
  const month = d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  return `${dayOfWeek} ${String(day).padStart(2, "0")} ${month}`;
}

function formatSteps(n: number | string): string {
  const num = typeof n === "string" ? parseInt(n, 10) : n;
  return Number.isNaN(num) ? "0" : num.toLocaleString("en-US");
}

/** User has a device connected (from 2026_users.provider) */
function hasDevice(provider: AppUser["provider"] | undefined): boolean {
  return provider === "garmin" || provider === "polar" || provider === "oura" || provider === "google";
}

/** User has no device (null or undefined) */
function hasNoDevice(provider: AppUser["provider"] | undefined): boolean {
  return provider === null || provider === undefined;
}

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
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [userLoadDone, setUserLoadDone] = useState(false);
  const [weeklySteps, setWeeklySteps] = useState<{ date: string; steps: number; attestation_hash: string | null }[]>([]);
  const [weeklyStepsLoading, setWeeklyStepsLoading] = useState(false);
  const [attestingDate, setAttestingDate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [homeTab, setHomeTab] = useState<"activity" | "instructions">("activity");

  const refetchUser = useCallback(async () => {
    const fid = context?.user?.fid;
    if (!fid) return;
    try {
      const res = await fetch(`/api/user?fid=${fid}`);
      const data = await res.json();
      if (data.success && data.user) setAppUser(data.user);
    } catch (e) {
      console.error("[LivMore] refetch user error:", e);
    }
  }, [context?.user?.fid]);

  const retryUserLoad = useCallback(async () => {
    const fid = context?.user?.fid;
    if (!fid) return;
    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fid,
          username: neynarUser?.username ?? context?.user?.username ?? null,
          eth_address: neynarUser?.custody_address ?? null,
        }),
      });
      const data = await res.json();
      if (data.success && data.user) setAppUser(data.user);
    } catch (e) {
      console.error("[LivMore] retry ensure user error:", e);
    } finally {
      setUserLoadDone(true);
    }
  }, [context?.user?.fid, context?.user?.username, neynarUser?.username, neynarUser?.custody_address]);

  const handleAttest = useCallback(async (date: string, steps?: number) => {
    if (!appUser || attestingDate) return;
    setAttestingDate(date);
    try {
      // 1. Farcaster wallet signer (for sendTransaction)
      const farcasterProvider = new ethers.BrowserProvider(sdk.wallet.ethProvider);
      const farcasterSigner = await farcasterProvider.getSigner();
      const walletAddress = await farcasterSigner.getAddress();

      // 2. Hybrid signer: reads via public RPC, writes via Farcaster wallet
      const readProvider = new ethers.JsonRpcProvider(BASE_RPC);
      const hybridSigner = new HybridSigner(readProvider, farcasterSigner);

      // 3. Server signs the attestation with user's wallet as recipient (no gas)
      const signRes = await fetch("/api/attest/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: appUser.id, date, walletAddress }),
      });
      const signData = await signRes.json();
      if (!signData.ok) {
        console.error("[LivMore] attest/sign error:", signData.error);
        return;
      }

      const { signature, message, attester, stepId } = signData;

      // 4. EAS uses hybrid signer — reads go to RPC, writes go to Farcaster
      const eas = new EAS(EAS_CONTRACT);
      eas.connect(hybridSigner);

      const tx = await eas.attestByDelegation({
        schema: signData.schema,
        data: {
          recipient: message.recipient,
          expirationTime: BigInt(message.expirationTime),
          revocable: message.revocable,
          refUID: message.refUID,
          data: message.data,
          value: BigInt(message.value),
        },
        signature,
        attester,
        deadline: BigInt(message.deadline),
      });

      // 5. HybridSigner handles builder code (ERC-8021) automatically in sendTransaction
      const attestationUID = await tx.wait();

      // 6. Confirm to server to persist in DB
      await fetch("/api/attest/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId, attestationUID }),
      });

      // 7. Update local state
      setWeeklySteps((prev) =>
        prev.map((s) =>
          s.date === date ? { ...s, attestation_hash: attestationUID } : s
        )
      );

      // 8. Offer to share
      const easLink = `https://base.easscan.org/attestation/view/${attestationUID}`;
      const stepsNum = steps ?? 0;
      const dateFormatted = formatDateDayWeekMonth(date);
      const shareText = `💎 Onchain proof of ${stepsNum.toLocaleString()} steps on ${dateFormatted}
Attested on @base.base.eth by @livmore, powered by EAS
Tracking healthy habits, one step at a time 👟`;
      try {
        await sdk.actions.composeCast({ text: shareText, embeds: [easLink] });
      } catch (shareErr) {
        console.warn("[LivMore] composeCast after attest:", shareErr);
      }
    } catch (e) {
      console.error("[LivMore] attest failed:", e);
    } finally {
      setAttestingDate(null);
    }
  }, [appUser, attestingDate, context?.user?.fid]);

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
              if (data.success && data.user) {
                if (mounted) setAppUser(data.user);
              } else if (!data.success) {
                console.error("[LivMore] ensure user failed:", data.error);
              }
            } catch (e) {
              console.error("[LivMore] ensure user error:", e);
            } finally {
              if (mounted) setUserLoadDone(true);
            }
          } else {
            if (mounted) setUserLoadDone(true);
          }
        } else {
          if (mounted) setUserLoadDone(true);
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

  // After OAuth redirect (?garmin=connected or ?polar=connected), refetch user so provider is up to date
  useEffect(() => {
    if (!sdkReady || !context?.user?.fid) return;
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    if (params?.get("garmin") === "connected" || params?.get("polar") === "connected" || params?.get("oura") === "success" || params?.get("google") === "success") {
      refetchUser();
      // Clean URL without full reload
      const url = new URL(window.location.href);
      url.searchParams.delete("garmin");
      url.searchParams.delete("polar");
      url.searchParams.delete("oura");
      url.searchParams.delete("google");
      window.history.replaceState({}, "", url.pathname + (url.search || ""));
    }
  }, [sdkReady, context?.user?.fid, refetchUser]);

  // Sync Google Fit steps when user opens app with provider=google
  useEffect(() => {
    if (appUser?.provider === "google" && appUser?.fid) {
      fetch(`/api/google/sync?fid=${appUser.fid}`);
    }
  }, [appUser?.provider, appUser?.fid]);

  // Fetch last 10 days of steps (yesterday back) when user has a device (Garmin/Polar)
  useEffect(() => {
    if (!appUser?.fid || !hasDevice(appUser.provider)) {
      setWeeklySteps([]);
      return;
    }
    const { from, to } = getLast10DaysRange();
    setWeeklyStepsLoading(true);
    fetch(`/api/steps/daily?fid=${appUser.fid}&from=${from}&to=${to}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.steps)) {
          setWeeklySteps(
            data.steps.map((s: { date: string; steps: number; attestation_hash?: string | null }) => ({
              date: s.date,
              steps: Number(s.steps) || 0,
              attestation_hash: s.attestation_hash ?? null,
            }))
          );
        } else {
          setWeeklySteps([]);
        }
      })
      .catch(() => setWeeklySteps([]))
      .finally(() => setWeeklyStepsLoading(false));
  }, [appUser?.fid, appUser?.provider]);

  // Last 10 calendar days (yesterday back) for table rows — same range we request from API
  const activityDates = (() => {
    const { from, to } = getLast10DaysRange();
    const dates: string[] = [];
    const d = new Date(from + "T12:00:00Z");
    const end = new Date(to + "T12:00:00Z");
    while (d <= end) {
      dates.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return dates;
  })();
  const stepsByDate = new Map(weeklySteps.map((s) => [s.date, s.steps]));
  const attestationByDate = new Map(weeklySteps.map((s) => [s.date, s.attestation_hash]));

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

  if (context && !context.user) {
    return (
      <div className={`min-h-screen bg-black text-white flex items-center justify-center p-4 ${protoMono.className}`}>
        <p className="text-gray-400 text-center">Open from Farcaster to use LivMore.</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-black text-white flex flex-col ${protoMono.className}`}>
      {/* Top bar: floating */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-3 py-2 bg-black/95 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center gap-2 min-w-0">
          <Image
            src="/livMore_w.png"
            alt=""
            width={32}
            height={32}
            className="shrink-0"
            priority
          />
          <span className={`text-lg font-bold truncate ${protoMono.className}`}>LivMore</span>
        </div>
        <button
          type="button"
          onClick={() => router.push("/control-panel")}
          className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-gray-900 border border-gray-700 hover:bg-gray-800 hover:border-gray-600 transition-colors shrink-0"
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

      {activeTab === "leaderboard" && <Leaderboard />}
      {activeTab === "steps" && (
        <Steps
          currentUserFid={context?.user?.fid}
          onShareLeaderboard={async (shareUrl, shareText) => {
            try {
              await sdk.actions.composeCast({ text: shareText, embeds: [shareUrl] });
            } catch (e) {
              console.warn("[LivMore] composeCast leaderboard:", e);
            }
          }}
        />
      )}
      {activeTab === "og" && <OG />}
      {activeTab === "home" && hasDevice(appUser?.provider) ? (
        <main className={`flex-1 flex flex-col p-4 pt-14 pb-16 overflow-auto ${protoMono.className}`}>
          <h1 className="text-xl text-center font-semibold text-white mb-1">One Step at a Time</h1>

          {/* Tabs */}
          <div className="flex border-b border-gray-700 mb-4">
            <button
              type="button"
              onClick={() => setHomeTab("activity")}
              className={`flex-1 py-3 text-sm uppercase tracking-wider transition-colors ${
                homeTab === "activity"
                  ? "text-white border-b-2 border-[#ff8800]"
                  : "text-gray-500 border-b-2 border-transparent hover:text-gray-300"
              }`}
            >
              Latest Activity
            </button>
            <button
              type="button"
              onClick={() => setHomeTab("instructions")}
              className={`flex-1 py-3 text-sm uppercase tracking-wider transition-colors ${
                homeTab === "instructions"
                  ? "text-white border-b-2 border-[#ff8800]"
                  : "text-gray-500 border-b-2 border-transparent hover:text-gray-300"
              }`}
            >
              How LivMore works!
            </button>
          </div>

          {/* Latest Activity tab */}
          {homeTab === "activity" && (
            <section className="w-full max-w-sm mx-auto">
              {weeklyStepsLoading ? (
                <p className="text-gray-500 text-sm text-center py-8">Loading…</p>
              ) : (
                <div className={`overflow-hidden rounded-lg border border-gray-700 ${protoMono.className}`}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white border-b border-gray-700">
                        <th className="text-left py-2 px-3 font-semibold">Date</th>
                        <th className="text-right py-2 px-3 font-semibold">Steps</th>
                        <th className="text-center py-2 px-3 font-semibold">Attestation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...activityDates].reverse().map((date) => {
                        const steps = stepsByDate.get(date);
                        const attestationHash = attestationByDate.get(date);
                        const isAttesting = attestingDate === date;
                        const today = getTodayUTC();
                        const yesterday = getYesterdayUTC();
                        const todaySteps = stepsByDate.get(today) ?? 0;
                        // Yesterday is attestable only when today has activity (day has turned over)
                        const canAttestYesterday = date === yesterday && todaySteps > 0;
                        const canAttestOlder = date < yesterday;
                        const canAttest =
                          steps !== undefined &&
                          steps > 0 &&
                          !attestationHash &&
                          date < today &&
                          (canAttestYesterday || canAttestOlder);
                        return (
                          <tr key={date} className="border-b border-gray-800 last:border-0">
                            <td className="py-2 px-3 text-gray-300">
                              {formatDateDayWeekMonth(date)}
                            </td>
                            <td className="py-2 px-3 text-right text-white font-medium">
                              {steps !== undefined ? formatSteps(steps) : "—"}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {attestationHash ? (
                                <a
                                  href={`https://base.easscan.org/attestation/view/${attestationHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-green-500 hover:text-green-400 text-xs"
                                  aria-label="View attestation"
                                >
                                  <span>✓</span>
                                  <span className="underline">View</span>
                                </a>
                              ) : isAttesting ? (
                                <span className="inline-flex items-center gap-1 text-yellow-400 text-xs">
                                  <span className="w-3 h-3 border-t-2 border-yellow-400 rounded-full animate-spin" />
                                  Attesting…
                                </span>
                              ) : canAttest ? (
                                <button
                                  type="button"
                                  onClick={() => handleAttest(date, steps)}
                                  className={`text-[#ff8800] hover:text-white text-xs underline ${protoMono.className}`}
                                >
                                  Attest
                                </button>
                              ) : (
                                <span className="text-gray-600 text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-gray-500 text-xs text-center mt-2 tracking-wide">
                Only attested days count toward the weekly leaderboard.
              </p>
              {!weeklyStepsLoading &&
                (stepsByDate.get(getYesterdayUTC()) ?? 0) > 0 &&
                !attestationByDate.get(getYesterdayUTC()) &&
                (stepsByDate.get(getTodayUTC()) ?? 0) === 0 && (
                  <p className="text-gray-500 text-xs text-center mt-2 tracking-wide">
                    Sync your wearable to see today&apos;s steps and enable Attest for yesterday.
                  </p>
                )}
            </section>
          )}

          {/* Instructions / How to tab */}
          {homeTab === "instructions" && (
            <section className="w-full max-w-sm mx-auto space-y-3">
              <div className={`text-sm text-white space-y-3 ${protoMono.className}`}>
                <p>
                  Connect your wearable and start tracking your daily steps. Each competition week runs from <span className="font-semibold">Monday to Sunday.</span>
                </p>
                <p>
                  <span className="font-semibold">Attestations are required.</span> Only days you manually attest count toward the weekly leaderboard. Each day closes at <span className="font-semibold">6:00 PM CST (UTC-6)</span> — you can attest any previous day after it has closed.
                </p>
                <p>
                  <span className="font-semibold">Weekly prizes</span> are distributed every week from 100% of tx fees collected in $STEPS tokens:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>60% split equally among the <span className="font-semibold">Top 5</span> users with the most attested steps</li>
                  <li>20% to the <span className="font-semibold">NFT holder</span> with the most attested steps</li>
                  <li>20% to the <span className="font-semibold">OG minter</span> with the most attested steps</li>
                </ul>
                <p>
                  A single user can win in multiple categories simultaneously.
                </p>
                <p>
                  <span className="font-semibold">OG status</span> is permanently assigned to the 343 original minters and never changes.
                </p>
              </div>
            </section>
          )}
        </main>
      ) : activeTab === "home" && appUser && hasNoDevice(appUser.provider) ? (
        <div className="flex-1 flex flex-col pt-14 pb-16 overflow-auto">
          <ConnectDevice user={appUser} onProviderSet={refetchUser} />
        </div>
      ) : activeTab === "home" && context?.user?.fid && !userLoadDone ? (
        <main className="flex-1 flex flex-col items-center justify-center p-2 pt-14 pb-16 gap-2 overflow-auto">
          <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin" />
          <p className={protoMono.className}>Loading your account…</p>
        </main>
      ) : activeTab === "home" && userLoadDone && context?.user?.fid && !appUser ? (
        <main className="flex-1 flex flex-col items-center justify-center p-2 pt-14 pb-16 gap-2 overflow-auto">
          <p className={`text-gray-400 ${protoMono.className}`}>Could not load your account.</p>
          <Boton onClick={retryUserLoad} className="mt-2">Retry</Boton>
        </main>
      ) : activeTab === "home" ? (
      <main className="flex-1 flex flex-col items-center justify-center p-2 pt-14 pb-16 gap-2 overflow-auto">
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

        <section className="w-full max-w-sm mt-4 space-y-2">
          <p className={`text-gray-400 text-center text-sm max-w-sm ${protoMono.className}`}>
            The OG token mint has ended. Thank you to everyone who minted! We&apos;re working on the site—more coming soon. Stay tuned.
          </p>
        </section>

        {/* FAQs */}
        <section className={`w-full max-w-sm mt-4 p-4 rounded-xl border-2 border-dashed border-gray-600 bg-black ${protoMono.className}`}>
          <p className="text-sm text-gray-400">Wen token: soon, via Clanker</p>
          <p className="text-sm text-gray-400">Supported devices: Garmin, Polar, Oura, Google Fit</p>
        </section>
      </main>
      ) : null}

      {/* Bottom menu: floating */}
      <nav className={`fixed bottom-0 left-0 right-0 z-50 border-t border-gray-800 bg-black/95 backdrop-blur-sm ${protoMono.className}`} aria-label="Bottom menu">
        <div className="grid grid-cols-4">
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className={`py-3 text-center transition-colors ${activeTab === "home" ? "text-white" : "text-gray-400 hover:text-gray-300"}`}
            title="Home"
          >
            🏠<br />
            HOME
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("leaderboard")}
            className={`py-3 text-center transition-colors ${activeTab === "leaderboard" ? "text-white" : "text-gray-400 hover:text-gray-300"}`}
            title="Leaderboard"
          >
            📈<br />
            RANK
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("steps")}
            className={`py-3 text-center transition-colors ${activeTab === "steps" ? "text-white" : "text-gray-400 hover:text-gray-300"}`}
            title="Steps"
          >
            👟<br />
            $STEPS
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("og")}
            className={`py-3 text-center transition-colors ${activeTab === "og" ? "text-white" : "text-gray-400 hover:text-gray-300"}`}
            title="OG"
          >
            💎<br />
            OG
          </button>
        </div>
      </nav>
    </div>
  );
}
