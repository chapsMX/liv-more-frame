"use client";

import Link from "next/link";
import { protoMono } from "../styles/fonts";

export default function ControlPanel() {
  return (
    <div className={`min-h-screen bg-black text-white flex flex-col ${protoMono.className}`}>
      <header className="flex items-center justify-between p-3 border-b border-gray-800">
        <Link
          href="/"
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          ← Back
        </Link>
        <h1 className={`text-lg font-semibold ${protoMono.className}`}>Control Panel</h1>
        <div className="w-12" />
      </header>
      <main className="flex-1 p-4">
        <p className="text-gray-500 text-sm">Panel de control. Contenido próximamente.</p>
      </main>
    </div>
  );
}
