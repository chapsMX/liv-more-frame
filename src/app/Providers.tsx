"use client";

import { MiniAppProvider } from "@neynar/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <MiniAppProvider>{children}</MiniAppProvider>;
}
