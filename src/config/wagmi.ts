import { http, createConfig } from 'wagmi'
import { base } from 'wagmi/chains'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'
import { metaMask, walletConnect, coinbaseWallet } from 'wagmi/connectors'

export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  connectors: [
    farcasterMiniApp(),
    metaMask(),
    coinbaseWallet({
      appName: 'Liv More',
      appLogoUrl: 'https://app.livmore.app/icon.png',
    }),
    ...(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ? [
      walletConnect({
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
        metadata: {
          name: 'Liv More',
          description: 'Turn healthy habits into rewards',
          url: 'https://app.livmore.life',
          icons: ['https://livmore.life/icon.png'],
        },
      })
    ] : []),
  ]
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
} 