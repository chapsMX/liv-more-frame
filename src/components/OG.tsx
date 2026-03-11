"use client";

import { protoMono } from "../styles/fonts";

export default function OG() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 pt-14 pb-16 overflow-auto">
      <h1 className={`text-xl font-semibold text-white ${protoMono.className}`}>
        OG Members
      </h1>
      <p className={`text-gray-400 text-center text-base max-w-sm ${protoMono.className}`}>
        Perks are coming soon, for Minters and Holders.
      </p>
    </main>
  );
}
