"use client";

import dynamic from "next/dynamic";

const LivMore = dynamic(() => import("../components/LivMore"), {
  ssr: false,
});

export default function App() {
  return <LivMore />;
}