"use client";

import Image from "next/image";
import { protoMono } from "@/styles/fonts";
import type { AppUser } from "@/types/user";

export default function GarminPanel({ user }: { user: AppUser }) {
  return (
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
        Garmin connected
      </p>
      <section className={`w-full max-w-sm mt-4 p-4 rounded-xl border-2 border-dashed border-gray-600 bg-black ${protoMono.className}`}>
        <p className="text-sm text-gray-500">Steps and activity will appear here.</p>
        <p className="text-xs text-gray-600 mt-2">User FID: {user.fid}</p>
      </section>
    </main>
  );
}
