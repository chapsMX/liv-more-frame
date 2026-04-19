"use client";

import { useEffect, useState, useCallback } from "react";
import { protoMono } from "../styles/fonts";

type MonthlyRow = {
  id: number;
  fid: number | null;
  username: string | null;
  display_name: string | null;
  basename: string | null;
  eth_address: string | null;
  auth_type: "farcaster" | "wallet" | null;
  og: boolean;
  total_steps: number;
  days_attested: number;
  rank: number;
};

type AllTimeRow = {
  record_type: "daily" | "weekly" | "monthly";
  steps: number;
  period_start: string;
  period_end: string;
  achieved_at: string;
  fid: number;
  username: string | null;
};

type FeedRow = {
  id: number;
  user_id: number;
  fid: number | null;
  username: string | null;
  display_name: string | null;
  basename: string | null;
  eth_address: string | null;
  auth_type: "farcaster" | "wallet" | null;
  og: boolean;
  date: string;
  steps: number;
  attested: boolean;
};

type NeynarUser = {
  fid: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function getDisplayName(row: {
  fid?: number | null;
  username?: string | null;
  display_name?: string | null;
  basename?: string | null;
  eth_address?: string | null;
  auth_type?: string | null;
}): string {
  if (row.auth_type === "wallet") {
    return row.basename ?? row.display_name ?? (row.eth_address ? truncateAddress(row.eth_address) : "—");
  }
  return row.username ?? `fid:${row.fid}`;
}

function PlatformBadge({ authType, og }: { authType?: string | null; og: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {authType === "wallet" ? (
        <svg width="12" height="12" viewBox="0 0 1280 1280" fill="none" className="inline shrink-0">
          <path
            d="M0,101.12c0-34.64,0-51.95,6.53-65.28,6.25-12.76,16.56-23.07,29.32-29.32C49.17,0,66.48,0,101.12,0h1077.76c34.63,0,51.96,0,65.28,6.53,12.75,6.25,23.06,16.56,29.32,29.32,6.52,13.32,6.52,30.64,6.52,65.28v1077.76c0,34.63,0,51.96-6.52,65.28-6.26,12.75-16.57,23.06-29.32,29.32-13.32,6.52-30.65,6.52-65.28,6.52H101.12c-34.64,0-51.95,0-65.28-6.52-12.76-6.26-23.07-16.57-29.32-29.32-6.53-13.32-6.53-30.65-6.53-65.28V101.12Z"
            fill="#0052ff"
          />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 1000 1000" fill="none" className="inline shrink-0">
          <path
            d="M847.387 270V343.023H774.425V415.985H796.779V416.01H847.387V810.795H725.173L725.099 810.434L662.737 515.101C656.791 486.949 641.232 461.477 618.927 443.362C596.623 425.248 568.527 415.275 539.818 415.275H539.575C510.866 415.275 482.77 425.248 460.466 443.362C438.161 461.477 422.602 486.958 416.657 515.101L354.223 810.795H232V416.001H282.608V415.985H304.959V343.023H232V270H847.387Z"
            fill="#8B5CF6"
          />
        </svg>
      )}
      {og && <span className="text-amber-400 text-xs ml-0.5" title="OG">◆</span>}
    </span>
  );
}

function parseDate(val: string | null | undefined): Date {
  if (val == null) return new Date(NaN);
  const s = String(val).trim();
  if (!s) return new Date(NaN);
  if (s.includes("T")) return new Date(s);
  return new Date(s + "T12:00:00Z");
}

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatDate(dateStr: string): string {
  const d = parseDate(dateStr);
  if (isNaN(d.getTime())) return "—";
  return `${MONTH_NAMES_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function formatMonth(dateStr: string): string {
  const d = parseDate(dateStr);
  if (isNaN(d.getTime())) return "—";
  return `${MONTH_NAMES_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function formatWeek(startStr: string, endStr: string): string {
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "—";
  const startFmt = `${MONTH_NAMES_SHORT[start.getUTCMonth()]} ${start.getUTCDate()}`;
  const endFmt = `${MONTH_NAMES_SHORT[end.getUTCMonth()]} ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  return `${startFmt}–${endFmt}`;
}

function formatSteps(n: number | string): string {
  const num = typeof n === "string" ? parseInt(n, 10) : n;
  return Number.isNaN(num) ? "0" : num.toLocaleString("en-US");
}

type AvailableMonth = { year: number; month: number };

export default function Leaderboard() {
  const now = new Date();
  const [availableMonths, setAvailableMonths] = useState<AvailableMonth[]>([]);
  const [monthsLoaded, setMonthsLoaded] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([]);
  const [allTimeData, setAllTimeData] = useState<AllTimeRow[]>([]);
  const [pfpMap, setPfpMap] = useState<Record<number, string>>({});
  const [displayNameMap, setDisplayNameMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [allTimeLoading, setAllTimeLoading] = useState(true);
  const [feedData, setFeedData] = useState<FeedRow[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [tab, setTab] = useState<"monthly" | "alltime" | "feed">("monthly");

  const { year, month } = (() => {
    const m = availableMonths.find((a) => `${a.year}-${a.month}` === selectedKey);
    if (m) return m;
    if (availableMonths.length > 0) {
      const first = availableMonths[0];
      return { year: first.year, month: first.month };
    }
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  })();

  const fetchAvailableMonths = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard/months");
      const data = await res.json();
      const raw = (Array.isArray(data) ? data : []) as AvailableMonth[];
      const d = new Date();
      const curY = d.getFullYear();
      const curM = d.getMonth() + 1;

      const hasCurrent = raw.some((x) => x.year === curY && x.month === curM);
      const merged: AvailableMonth[] = hasCurrent ? [...raw] : [{ year: curY, month: curM }, ...raw];

      merged.sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month));

      setAvailableMonths(merged);
      setSelectedKey((prev) => (prev ? prev : `${curY}-${curM}`));
    } catch (e) {
      console.error("[Leaderboard] months fetch error:", e);
      setAvailableMonths([]);
    } finally {
      setMonthsLoaded(true);
    }
  }, []);

  const fetchMonthly = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard/monthly?year=${year}&month=${month}`);
      const data = await res.json();
      setMonthlyData(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("[Leaderboard] monthly fetch error:", e);
      setMonthlyData([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  const fetchAllTime = useCallback(async () => {
    setAllTimeLoading(true);
    try {
      const res = await fetch("/api/leaderboard/alltime");
      const data = await res.json();
      setAllTimeData(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("[Leaderboard] alltime fetch error:", e);
      setAllTimeData([]);
    } finally {
      setAllTimeLoading(false);
    }
  }, []);

  const fetchFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const res = await fetch("/api/leaderboard/feed?limit=200");
      const data = await res.json();
      setFeedData(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("[Leaderboard] feed fetch error:", e);
      setFeedData([]);
    } finally {
      setFeedLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailableMonths();
  }, []);

  useEffect(() => {
    fetchMonthly();
  }, [fetchMonthly]);

  useEffect(() => {
    fetchAllTime();
  }, [fetchAllTime]);

  useEffect(() => {
    if (tab === "feed") fetchFeed();
  }, [tab, fetchFeed]);

  useEffect(() => {
    const dataToUse = tab === "feed" ? feedData : monthlyData;
    if (dataToUse.length === 0) {
      setPfpMap({});
      setDisplayNameMap({});
      return;
    }
    const uniqueFids = [...new Set(dataToUse.map((r) => r.fid))];
    const fids = uniqueFids.join(",");
    fetch(`/api/neynar?fids=${encodeURIComponent(fids)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.success || !data.users) return;
        const pfp: Record<number, string> = {};
        const display: Record<number, string> = {};
        (data.users as NeynarUser[]).forEach((u) => {
          if (u.pfp_url) pfp[u.fid] = u.pfp_url;
          if (u.display_name) display[u.fid] = u.display_name;
        });
        setPfpMap(pfp);
        setDisplayNameMap(display);
      })
      .catch((e) => console.error("[Leaderboard] neynar fetch error:", e));
  }, [monthlyData, feedData, tab]);

  const allTimeByType = {
    daily: allTimeData.find((r) => r.record_type === "daily"),
    weekly: allTimeData.find((r) => r.record_type === "weekly"),
    monthly: allTimeData.find((r) => r.record_type === "monthly"),
  };

  return (
    <main className={`flex-1 flex flex-col p-4 pt-14 pb-16 overflow-auto ${protoMono.className}`}>
      <h1 className="text-xl text-center font-semibold text-white mb-4">Farcaster Monthly Leaderboard</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-4">
        <button
          type="button"
          onClick={() => setTab("monthly")}
          className={`flex-1 py-3 text-sm uppercase tracking-wider transition-colors ${
            tab === "monthly"
              ? "text-white border-b-2 border-[#ff8800]"
              : "text-gray-500 border-b-2 border-transparent hover:text-gray-300"
          }`}
        >
          Monthly Feed<br />
          Attested
        </button>
        <button
          type="button"
          onClick={() => setTab("feed")}
          className={`flex-1 py-3 text-sm uppercase tracking-wider transition-colors ${
            tab === "feed"
              ? "text-white border-b-2 border-[#ff8800]"
              : "text-gray-500 border-b-2 border-transparent hover:text-gray-300"
          }`}
        >
          Daily Feed<br />
          Unattested
        </button>
        <button
          type="button"
          onClick={() => setTab("alltime")}
          className={`flex-1 py-3 text-sm uppercase tracking-wider transition-colors ${
            tab === "alltime"
              ? "text-white border-b-2 border-[#ff8800]"
              : "text-gray-500 border-b-2 border-transparent hover:text-gray-300"
          }`}
        >
          All-Time<br />
          Records!
        </button>
      </div>

      {/* Monthly tab */}
      {tab === "monthly" && (
        <section className="w-full max-w-sm mx-auto">
          {/* Month filter */}
          <div className="mb-4">
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#ff8800]"
            >
              {!monthsLoaded ? (
                <option value="">Loading months…</option>
              ) : availableMonths.length === 0 ? (
                <option value="">No months with data yet</option>
              ) : (
                availableMonths.map((m) => (
                  <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                    {MONTH_NAMES[m.month - 1]} {m.year}
                  </option>
                ))
              )}
            </select>
          </div>

          {loading ? (
            <p className="text-gray-500 text-sm text-center py-8">Loading…</p>
          ) : monthlyData.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No data for this month.</p>
          ) : (
<div className="space-y-0.5">
  {monthlyData.map((row) => (
    <div
      key={row.id}
      className={`flex items-center gap-3 py-1.5 px-2 rounded bg-gray-900/50 border border-gray-800 ${protoMono.className}`}
    >
      <span className="text-white font-bold text-sm shrink-0 w-4">#{row.rank}</span>
      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 shrink-0">
        {row.fid && pfpMap[row.fid] ? (
          <img
            src={pfpMap[row.fid]}
            alt=""
            className="w-full h-full object-cover"
            width={40}
            height={40}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
            ?
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">
          {row.fid ? (displayNameMap[row.fid] ?? getDisplayName(row)) : getDisplayName(row)}
          {" "}<PlatformBadge authType={row.auth_type} og={row.og} />
        </p>
        <p className="text-gray-400 text-sm truncate">
          {row.auth_type === "wallet"
            ? (row.eth_address ? truncateAddress(row.eth_address) : "—")
            : `@${row.username ?? `fid:${row.fid}`}`}
        </p>
      </div>
      <span className="text-white font-bold text-lg shrink-0">
        {formatSteps(row.total_steps)} 👟
      </span>
    </div>
  ))}
</div>
          )}
        </section>
      )}

      {/* Feed tab */}
      {tab === "feed" && (
  <section className="w-full max-w-sm mx-auto">
    {feedLoading ? (
      <p className="text-gray-500 text-sm text-center py-8">Loading…</p>
    ) : feedData.length === 0 ? (
      <p className="text-gray-500 text-sm text-center py-8">No activity yet.</p>
    ) : (
      <div className="space-y-0.5">
        {feedData.map((row) => (
          <div
            key={`${row.user_id}-${row.date}`}
            className={`flex items-center gap-3 py-1.5 px-2 rounded bg-gray-900/50 border border-gray-800 ${protoMono.className}`}
          >
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 shrink-0">
              {row.fid && pfpMap[row.fid] ? (
                <img
                  src={pfpMap[row.fid]}
                  alt=""
                  className="w-full h-full object-cover"
                  width={40}
                  height={40}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                  ?
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">
                {row.fid ? (displayNameMap[row.fid] ?? getDisplayName(row)) : getDisplayName(row)}
                {" "}<PlatformBadge authType={row.auth_type} og={row.og} />
              </p>
              <p className="text-gray-400 text-sm truncate">
                {formatDate(row.date)}
                {row.attested && (
                  <span className="ml-1 text-emerald-400" title="Attested">✓</span>
                )}
              </p>
            </div>
            <span className="text-white font-bold text-lg shrink-0">
              {formatSteps(row.steps)} 👟
            </span>
          </div>
        ))}
      </div>
    )}
  </section>
)}

      {/* All-Time tab */}
      {tab === "alltime" && (
        <section className="w-full max-w-sm mx-auto">
          {allTimeLoading ? (
            <p className="text-gray-500 text-sm text-center py-8">Loading…</p>
          ) : (
            <div className="rounded-lg border border-gray-700 overflow-hidden divide-y divide-gray-800">
              <div className="py-2 px-3">
                <p className="text-gray-400 text-sm">More steps in a single day:</p>
                {allTimeByType.daily ? (
                  <p className="text-white text-sm mt-1">
                    @{allTimeByType.daily.username ?? `fid:${allTimeByType.daily.fid}`} — {formatSteps(allTimeByType.daily.steps)} — {formatDate(allTimeByType.daily.period_start)}
                  </p>
                ) : (
                  <p className="text-gray-600 text-sm mt-1">—</p>
                )}
              </div>
              <div className="py-2 px-3">
                <p className="text-gray-400 text-sm">More steps in a month:</p>
                {allTimeByType.monthly ? (
                  <p className="text-white text-sm mt-1">
                    @{allTimeByType.monthly.username ?? `fid:${allTimeByType.monthly.fid}`} — {formatSteps(allTimeByType.monthly.steps)} — {formatMonth(allTimeByType.monthly.period_start)}
                  </p>
                ) : (
                  <p className="text-gray-600 text-sm mt-1">—</p>
                )}
              </div>
              <div className="py-2 px-3">
                <p className="text-gray-400 text-sm">More steps in a week:</p>
                {allTimeByType.weekly ? (
                  <p className="text-white text-sm mt-1">
                    @{allTimeByType.weekly.username ?? `fid:${allTimeByType.weekly.fid}`} — {formatSteps(allTimeByType.weekly.steps)} — {formatWeek(allTimeByType.weekly.period_start, allTimeByType.weekly.period_end)}
                  </p>
                ) : (
                  <p className="text-gray-600 text-sm mt-1">—</p>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
