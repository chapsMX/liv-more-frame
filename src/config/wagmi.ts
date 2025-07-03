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
      appName: 'LivMore',
      appLogoUrl: 'https://livmore.app/icon.png',
    }),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
      metadata: {
        name: 'LivMore',
        description: 'Turn healthy habits into rewards',
        url: 'https://livmore.app',
        icons: ['https://livmore.app/icon.png'],
      },
    }),
  ]
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
} 