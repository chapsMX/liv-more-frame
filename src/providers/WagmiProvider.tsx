'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { config } from '../config/wagmi';
import { useState, useEffect } from 'react';

interface WagmiProviderWrapperProps {
  children: React.ReactNode;
}

// Create QueryClient outside component to avoid hydration issues
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Disable automatic refetching for better performance in Mini Apps
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

export function WagmiProviderWrapper({ children }: WagmiProviderWrapperProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
} 