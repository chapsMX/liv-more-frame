"use client";

import { useEffect, useState, useCallback } from "react";
import { protoMono } from "../styles/fonts";

type MonthlyRow = {
  id: number;
  fid: number;
  username: string | null;
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
      const months = Array.isArray(data) ? data : [];
      setAvailableMonths(months);
      setSelectedKey((prev) => (prev ? prev : months.length > 0 ? `${months[0].year}-${months[0].month}` : ""));
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
    if (monthlyData.length === 0) {
      setPfpMap({});
      setDisplayNameMap({});
      return;
    }
    const fids = monthlyData.map((r) => String(r.fid)).join(",");
    fetch(`/api/neynar?fids=${fids}`)
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
  }, [monthlyData]);

  const allTimeByType = {
    daily: allTimeData.find((r) => r.record_type === "daily"),
    weekly: allTimeData.find((r) => r.record_type === "weekly"),
    monthly: allTimeData.find((r) => r.record_type === "monthly"),
  };

  return (
    <main className="flex-1 flex flex-col items-center p-4 pt-14 pb-16 overflow-auto">
      <h1 className={`text-xl text-center font-semibold text-white ${protoMono.className}`}>
        Farcaster Monthly Leaderboard
      </h1>

      {/* Month filter - dynamic, only months with attested data */}
      <div className={`flex items-center mt-3 mb-4 w-full max-w-sm ${protoMono.className}`}>
        <select
          value={selectedKey || (availableMonths[0] ? `${availableMonths[0].year}-${availableMonths[0].month}` : "")}
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

      {/* Monthly leaderboard - card-style list */}
      <section className="w-full max-w-sm">
        {loading ? (
          <p className={`text-gray-500 text-sm ${protoMono.className}`}>Loading…</p>
        ) : monthlyData.length === 0 ? (
          <p className={`text-gray-500 text-sm py-4 text-center ${protoMono.className}`}>No data for this month.</p>
        ) : (
          <div className="space-y-0.5">
            {monthlyData.map((row) => (
              <div
                key={row.id}
                className={`flex items-center gap-3 py-1.5 px-2 rounded bg-gray-900/50 border border-gray-800 ${protoMono.className}`}
              >
                <span className="text-white font-bold text-sm shrink-0 w-8">#{row.rank}</span>
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 shrink-0">
                  {pfpMap[row.fid] ? (
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
                    {displayNameMap[row.fid] ?? row.username ?? `fid:${row.fid}`}
                    {row.og && <span className="ml-1 text-amber-400" title="OG">★</span>}
                  </p>
                  <p className="text-gray-400 text-sm truncate">@{row.username ?? `fid:${row.fid}`}</p>
                </div>
                <span className="text-white font-bold text-lg shrink-0">
                {formatSteps(row.total_steps)} 👟
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* All time leaderboard */}
      <section className={`w-full max-w-sm mt-6 ${protoMono.className}`}>
      <h1 className={`text-xl text-center font-semibold text-white ${protoMono.className}`}>
        Farcaster All-Time Leaderboard
      </h1>
        {allTimeLoading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : (
          <div className="rounded-lg border border-gray-700 overflow-hidden divide-y divide-gray-800">
            {/* More steps in a single day */}
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
            {/* More steps in a month */}
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
            {/* More steps in a week */}
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
    </main>
  );
}
