"use client";

import { useState, useEffect, useCallback } from "react";
import { protoMono } from "../styles/fonts";

type Entry = {
  id: number;
  fid: number | null;
  username: string | null;
  display_name: string | null;
  basename: string | null;
  eth_address: string | null;
  auth_type: "farcaster" | "wallet" | null;
  og: boolean;
  total_valid_steps: number;
  rank: number;
};

type Competition = {
  id: number;
  week_number: number;
  year: number;
  week_start: string;
  week_end: string;
};

type WeekHistory = {
  week_number: number;
  year: number;
  week_start: string;
  week_end: string;
  general: Entry[];
};

type NeynarUser = {
  fid: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
};

function formatSteps(n: number | string): string {
  const num = typeof n === "string" ? parseInt(n, 10) : n;
  return Number.isNaN(num) ? "0" : num.toLocaleString("en-US");
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + (start.includes("T") ? "" : "T12:00:00Z"));
  const e = new Date(end + (end.includes("T") ? "" : "T12:00:00Z"));
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function getDisplayName(entry: Entry): string {
  if (entry.auth_type === "wallet") {
    return entry.basename ?? entry.display_name ?? (entry.eth_address ? truncateAddress(entry.eth_address) : "—");
  }
  return entry.username ?? `fid:${entry.fid}`;
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

function LeaderboardRow({
  entry,
  pfpMap,
  displayNameMap,
}: {
  entry: Entry;
  pfpMap: Record<number, string>;
  displayNameMap: Record<number, string>;
}) {
  const name = entry.fid && displayNameMap[entry.fid]
    ? displayNameMap[entry.fid]
    : getDisplayName(entry);

  const subtitle = entry.auth_type === "wallet"
    ? (entry.eth_address ? truncateAddress(entry.eth_address) : "—")
    : `@${entry.username ?? `fid:${entry.fid}`}`;

  return (
    <div className={`flex items-center gap-3 py-1.5 px-2 rounded bg-gray-900/50 border border-gray-800 ${protoMono.className}`}>
      <span className="text-white font-bold text-sm shrink-0 w-4">#{entry.rank}</span>
      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 shrink-0">
        {entry.fid && pfpMap[entry.fid] ? (
          <img src={pfpMap[entry.fid]} alt="" className="w-full h-full object-cover" width={40} height={40} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">?</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">
          {name}{" "}<PlatformBadge authType={entry.auth_type} og={entry.og} />
        </p>
        <p className="text-gray-400 text-sm truncate">{subtitle}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-white font-bold text-lg">{formatSteps(entry.total_valid_steps)}</span>
        <span className="text-gray-500 text-sm">👟</span>
      </div>
    </div>
  );
}

function todayYYYYMMDDHHMMSS(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
}

export default function Steps({
  currentUserFid,
  onShareLeaderboard,
}: {
  currentUserFid?: number;
  onShareLeaderboard?: (shareUrl: string, shareText: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<"current" | "history">("current");
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [general, setGeneral] = useState<Entry[]>([]);
  const [history, setHistory] = useState<WeekHistory[]>([]);
  const [pfpMap, setPfpMap] = useState<Record<number, string>>({});
  const [displayNameMap, setDisplayNameMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [sharing, setSharing] = useState(false);

  const myEntry = currentUserFid ? general.find((e) => e.fid === currentUserFid) : undefined;
  const appUrl = process.env.NEXT_PUBLIC_URL?.replace(/\/+$/, "") ?? "";
  const canShare = currentUserFid && competition && onShareLeaderboard && appUrl && tab === "current";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [weeklyRes, histRes] = await Promise.all([
        fetch("/api/leaderboard/weekly"),
        fetch("/api/leaderboard/weekly/history"),
      ]);
      const weekly = await weeklyRes.json();
      const hist = await histRes.json();

      setCompetition(weekly.competition ?? null);
      setGeneral(weekly.general ?? []);
      setHistory(Array.isArray(hist) ? hist : []);

      // Solo consultar Neynar para fids válidos
      const fids = new Set<number>();
      for (const e of weekly.general ?? []) {
        if (e.fid) fids.add(e.fid);
      }
      for (const w of hist ?? []) {
        for (const e of w.general ?? []) {
          if (e.fid) fids.add(e.fid);
        }
      }

      if (fids.size > 0) {
        const fidsStr = Array.from(fids).join(",");
        const neynarRes = await fetch(`/api/neynar?fids=${fidsStr}`);
        const neynar = await neynarRes.json();
        if (neynar.success && neynar.users) {
          const pfp: Record<number, string> = {};
          const display: Record<number, string> = {};
          (neynar.users as NeynarUser[]).forEach((u) => {
            if (u.pfp_url) pfp[u.fid] = u.pfp_url;
            if (u.display_name) display[u.fid] = u.display_name;
          });
          setPfpMap(pfp);
          setDisplayNameMap(display);
        }
      }
    } catch (e) {
      console.error("[Steps] load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedHistory = history[selectedWeek] ?? null;

  return (
    <main className={`flex-1 flex flex-col p-4 pt-14 pb-16 overflow-auto ${protoMono.className}`}>
      <h1 className="text-xl text-center font-semibold text-white mb-2">Weekly Leaderboard</h1>

      <div className="flex border-b border-gray-700 mb-2">
        <button type="button" onClick={() => setTab("current")}
          className={`flex-1 py-3 text-sm uppercase tracking-wider transition-colors ${tab === "current" ? "text-white border-b-2 border-[#ff8800]" : "text-gray-500 border-b-2 border-transparent hover:text-gray-300"}`}>
          This Week
        </button>
        <button type="button" onClick={() => setTab("history")}
          className={`flex-1 py-3 text-sm uppercase tracking-wider transition-colors ${tab === "history" ? "text-white border-b-2 border-[#ff8800]" : "text-gray-500 border-b-2 border-transparent hover:text-gray-300"}`}>
          History
        </button>
      </div>

      {tab === "current" && (
        <section className="w-full max-w-sm mx-auto">
          {competition && (
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-800">
              <span className="text-[#ff8800] font-bold text-sm uppercase tracking-wider">
                Week {competition.week_number}
              </span>
              <span className="text-gray-500 text-sm">
                {formatDateRange(competition.week_start, competition.week_end)}
              </span>
            </div>
          )}

          {canShare && (
            <button type="button"
              onClick={async () => {
                setSharing(true);
                try {
                  const date = todayYYYYMMDDHHMMSS();
                  const shareUrl = `${appUrl}/share/leaderboard/fid/${competition!.id}-${currentUserFid!}-${date}`;
                  const shareText = myEntry
                    ? `I'm #${myEntry.rank} on @livmore's Weekly Leaderboard with ${formatSteps(myEntry.total_valid_steps)} valid steps 👟\n@livmore rewards your steps with $STEPS token every week 👟\n\nTop 5 walkers split 60% of the weekly prize pool — 12% each.\n\nConnect your device, attest your steps and join the challenge 👇`
                    : `Steps Leaderboard\n@livmore rewards your steps with $STEPS token every week 👟\n\nTop 5 walkers split 60% of the weekly prize pool — 12% each.\n\nConnect your device, attest your steps and join the challenge 👇`;
                  await onShareLeaderboard(shareUrl, shareText);
                } catch (e) {
                  console.warn("[Steps] share failed:", e);
                } finally {
                  setSharing(false);
                }
              }}
              disabled={sharing}
              className="mt-4 w-full py-3 px-4 rounded-lg bg-[#ff8800] text-white font-semibold text-sm uppercase tracking-wider hover:bg-[#e67a00] disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
              {sharing ? "Opening…" : "Share my position"}
            </button>
          )}

          {loading ? (
            <p className="text-gray-500 text-sm text-center py-8">Loading…</p>
          ) : general.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No attested steps this week yet.</p>
          ) : (
            <div className="space-y-0.5">
              {general.map((e) => (
                <LeaderboardRow key={e.id} entry={e} pfpMap={pfpMap} displayNameMap={displayNameMap} />
              ))}
            </div>
          )}

          <p className="text-gray-500 text-xs text-center mt-5 tracking-wide">
            Only attested steps count toward the leaderboard.
          </p><br />
        </section>
      )}

      {tab === "history" && (
        <section className="w-full max-w-sm mx-auto">
          {history.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No completed weeks yet.</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
                <button type="button"
                  onClick={() => setSelectedWeek((w) => Math.min(w + 1, history.length - 1))}
                  disabled={selectedWeek >= history.length - 1}
                  className="bg-transparent border border-gray-600 text-white text-sm py-1.5 px-2.5 rounded disabled:opacity-20 disabled:cursor-not-allowed hover:border-gray-500">
                  ◀
                </button>
                <div className="flex flex-col items-center gap-0.5">
                  {selectedHistory && (
                    <>
                      <span className="text-[#ff8800] font-bold text-sm uppercase tracking-wider">
                        Week {selectedHistory.week_number}
                      </span>
                      <span className="text-gray-500 text-sm">
                        {formatDateRange(selectedHistory.week_start, selectedHistory.week_end)}
                      </span>
                    </>
                  )}
                </div>
                <button type="button"
                  onClick={() => setSelectedWeek((w) => Math.max(w - 1, 0))}
                  disabled={selectedWeek <= 0}
                  className="bg-transparent border border-gray-600 text-white text-sm py-1.5 px-2.5 rounded disabled:opacity-20 disabled:cursor-not-allowed hover:border-gray-500">
                  ▶
                </button>
              </div>

              {loading ? (
                <p className="text-gray-500 text-sm text-center py-8">Loading…</p>
              ) : !selectedHistory || selectedHistory.general.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No winners recorded for this week.</p>
              ) : (
                <div className="space-y-0.5">
                  {selectedHistory.general.map((e) => (
                    <LeaderboardRow key={`${e.fid}-${e.rank}`} entry={e} pfpMap={pfpMap} displayNameMap={displayNameMap} />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}