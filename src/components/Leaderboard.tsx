"use client";

import { protoMono } from "../styles/fonts";

export default function Leaderboard() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 pt-14 pb-16 overflow-auto">
      <h1 className={`text-xl font-semibold text-white ${protoMono.className}`}>
        Leaderboard
      </h1>
    </main>
  );
}
