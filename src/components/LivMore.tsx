"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { sdk } from "@farcaster/miniapp-sdk";
import type { Context } from "@farcaster/miniapp-core";
import { AddMiniApp } from "@farcaster/miniapp-core";
import Image from "next/image";
import { protoMono } from "../styles/fonts";
import { Boton } from "../styles/ui/boton";
import type { AppUser } from "@/types/user";
import GarminPanel from "./GarminPanel";
import PolarPanel from "./PolarPanel";
import ConnectDevice from "./ConnectDevice";

/** Only these FIDs can see Garmin/Polar connection buttons during the update period */
const ALLOWED_BETA_FIDS = [20701, 343393, 1020677];

/** Returns yesterday's date in UTC as YYYY-MM-DD */
function getYesterdayUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Returns from (7 days ago) and to (yesterday) in UTC YYYY-MM-DD for the weekly range */
function getLast7DaysRange(): { from: string; to: string } {
  const to = getYesterdayUTC();
  const d = new Date(to + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 6);
  const from = d.toISOString().slice(0, 10);
  return { from, to };
}

/** User has a device connected (from 2026_users.provider) */
function hasDevice(provider: AppUser["provider"] | undefined): boolean {
  return provider === "garmin" || provider === "polar";
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
  const [weeklySteps, setWeeklySteps] = useState<{ date: string; steps: number }[]>([]);
  const [weeklyStepsLoading, setWeeklyStepsLoading] = useState(false);

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
    if (params?.get("garmin") === "connected" || params?.get("polar") === "connected") {
      refetchUser();
      // Clean URL without full reload
      const url = new URL(window.location.href);
      url.searchParams.delete("garmin");
      url.searchParams.delete("polar");
      window.history.replaceState({}, "", url.pathname + (url.search || ""));
    }
  }, [sdkReady, context?.user?.fid, refetchUser]);

  // Fetch last 7 days of steps when user has a device (Garmin/Polar)
  useEffect(() => {
    if (!appUser?.fid || !hasDevice(appUser.provider)) {
      setWeeklySteps([]);
      return;
    }
    const { from, to } = getLast7DaysRange();
    setWeeklyStepsLoading(true);
    fetch(`/api/steps/daily?fid=${appUser.fid}&from=${from}&to=${to}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.steps)) {
          setWeeklySteps(
            data.steps.map((s: { date: string; steps: number }) => ({
              date: s.date,
              steps: Number(s.steps) || 0,
            }))
          );
        } else {
          setWeeklySteps([]);
        }
      })
      .catch(() => setWeeklySteps([]))
      .finally(() => setWeeklyStepsLoading(false));
  }, [appUser?.fid, appUser?.provider]);

  // Last 7 calendar days (from to to) for table rows — same range we request from API
  const weeklyDates = (() => {
    const { from, to } = getLast7DaysRange();
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

      {hasDevice(appUser?.provider) ? (
        <>
          {/* Weekly stats — últimos 7 días (o los que haya) */}
          <section className="w-full max-w-sm mx-auto px-3 pt-4 pb-2 shrink-0 border-b border-gray-800">
            <h2 className={`text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 ${protoMono.className}`}>
              Weekly stats
            </h2>
            {weeklyStepsLoading ? (
              <p className={`text-gray-500 text-sm ${protoMono.className}`}>Loading…</p>
            ) : (
              <div className={`overflow-hidden rounded-lg border border-gray-700 ${protoMono.className}`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-900 border-b border-gray-700">
                      <th className="text-left py-2 px-3 text-gray-400 font-semibold">Date</th>
                      <th className="text-right py-2 px-3 text-gray-400 font-semibold">Steps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyDates.map((date) => {
                      const steps = stepsByDate.get(date);
                      return (
                        <tr key={date} className="border-b border-gray-800 last:border-0">
                          <td className="py-2 px-3 text-gray-300">{date}</td>
                          <td className="py-2 px-3 text-right text-white font-medium">
                            {steps !== undefined ? steps.toLocaleString() : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {appUser!.provider === "garmin" ? (
            <GarminPanel user={appUser!} />
          ) : (
            <PolarPanel user={appUser!} />
          )}
        </>
      ) : appUser && hasNoDevice(appUser.provider) ? (
        ALLOWED_BETA_FIDS.includes(appUser.fid) ? (
          <ConnectDevice user={appUser} onProviderSet={refetchUser} />
        ) : (
          <main className="flex-1 flex flex-col items-center justify-center p-2 gap-2 overflow-auto">
            <div className="flex flex-row items-center justify-center w-full max-w-sm gap-4">
              <div className="flex flex-1 items-center justify-center">
                <Image src="/livMore_w.png" alt="Liv More" width={80} height={80} priority />
              </div>
              <div className="flex flex-1 items-center justify-center">
                <h1 className={`text-3xl font-bold ${protoMono.className}`}>LivMore</h1>
              </div>
            </div>
            <p className={`text-gray-400 text-center text-base max-w-sm mt-2 ${protoMono.className}`}>
              We&apos;re working on updating the app.
            </p>
            <p className={`text-gray-500 text-center text-sm max-w-sm ${protoMono.className}`}>
              Stay tuned for device connection and more.
            </p>
            <section className={`w-full max-w-sm mt-4 p-4 rounded-xl border-2 border-dashed border-gray-600 bg-black ${protoMono.className}`}>
              <p className="text-sm text-gray-400">Wen token: Soon, via Clanker</p>
              <p className="text-sm text-gray-400">Supported Devices: Garmin, Polar</p>
            </section>
          </main>
        )
      ) : context?.user?.fid && !userLoadDone ? (
        <main className="flex-1 flex flex-col items-center justify-center p-2 gap-2 overflow-auto">
          <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin" />
          <p className={protoMono.className}>Loading your account…</p>
        </main>
      ) : userLoadDone && context?.user?.fid && !appUser ? (
        <main className="flex-1 flex flex-col items-center justify-center p-2 gap-2 overflow-auto">
          <p className={`text-gray-400 ${protoMono.className}`}>Could not load your account.</p>
          <Boton onClick={retryUserLoad} className="mt-2">Retry</Boton>
        </main>
      ) : (
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

        <section className="w-full max-w-sm mt-4 space-y-2">
          <p className={`text-gray-400 text-center text-sm max-w-sm ${protoMono.className}`}>
            The OG token mint has ended. Thank you to everyone who minted! We&apos;re working on the site—more coming soon. Stay tuned.
          </p>
        </section>

        {/* FAQs */}
        <section className={`w-full max-w-sm mt-4 p-4 rounded-xl border-2 border-dashed border-gray-600 bg-black ${protoMono.className}`}>
          <p className="text-sm text-gray-400">Wen token: Soon, via Clanker</p>
          <p className="text-sm text-gray-400">Supported Devices: Garmin, Polar</p>
        </section>
      </main>
      )}

      <footer className="w-full py-4 text-center">
        <p className={`text-gray-500 text-sm ${protoMono.className}`}>
          built with <span className="text-red-500">❤</span> during ETH Denver
        </p>
      </footer>
    </div>
  );
}
