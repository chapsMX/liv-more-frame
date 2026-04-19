"use client";

import { protoMono } from "../styles/fonts";

export default function OG() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 pt-14 pb-16 overflow-auto">
      <h1 className={`text-xl font-semibold text-white ${protoMono.className}`}>
        OG Members
      </h1>
      <div className={`text-gray-400 text-center text-base max-w-md space-y-3 ${protoMono.className}`}>
        <p>
          <a
            href="https://opensea.io/collection/livmore-og"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-500 hover:text-green-400 underline"
          >
            LivMore OG on OpenSea
          </a>
        </p>
        <p>
          Weekly rewards are paid in <span className="text-white font-medium">$STEPS</span>. Contract:{" "}
          <a
            href="https://basescan.org/token/0x71EfeeA893a6706437913e6a8187573b58BB2B07"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-500 hover:text-green-400 underline break-all"
          >
            0x71EfeeA893a6706437913e6a8187573b58BB2B07
          </a>
        </p>
      </div>
    </main>
  );
}
