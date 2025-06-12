export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_URL;

  const config = {
    accountAssociation: {
      "header": "eyJmaWQiOjEwMjA2NzcsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHhhMzQzMWNFNzBkNkY3OGY3MzA1MThhQzFFNjFBMjYwNmRiRTIzNTUwIn0",
      "payload": "eyJkb21haW4iOiJhcHAubGl2bW9yZS5saWZlIn0",
      "signature": "MHhiMDEyOGMwMjdmZDVkNDBhMDBjMTAzYWE3Mjc0OWRiNGE4MzAwNWQ0YTkzMDE4ZTg0ZmE4MzM0Mzc3NTdmZGMxM2RlZWRhNWIxMmZmMzUyYzFhMTEyMWM4MDNhYmJkYTNhMjM1MmYwNTYwMDgyNzNjZmQyMWIwMDNjYmE0ODgxZjFj"
    },
    frame: {
      version: "1",
      name: "Liv More",
      iconUrl: `${appUrl}/icon.png`,
      homeUrl: appUrl,
      imageUrl: `${appUrl}/frameImage.png`,
      buttonTitle: "Join Liv More Whitelist",
      splashImageUrl: `${appUrl}/splash.png`,
      splashBackgroundColor: "#101827",
      webhookUrl: `https://api.neynar.com/f/app/51d0a8b5-4c69-4215-b709-ca9f4b8e7948/event`,
      subtitle: `Track -> Challenge -> Earn.`,
      description: `Gamifying wellness by integrating wearables, blockchain attestations and social challenges.`,
      primaryCategory: `health-fitness`,
      tags: [`health`, `biohacking`, `wearables`, `blockchain`, `challenges`],
      heroImageUrl: `${appUrl}/hero.png`,
      tagline: `Track -> Challenge -> Earn.`,
      ogTitle: `Liv More`,
      ogDescription: "Gamifying wellness by integrating wearables, blockchain attestations and social challenges.",
      ogImageUrl: `${appUrl}/hero.png`,
      screenshotUrls: [`${appUrl}/lm_01.jpg`, `${appUrl}/lm_02.jpg`, `${appUrl}/lm_04.jpg`],
      requiredChains: [
        "eip155:8453" // Base Mainnet
      ],
      requiredCapabilities: [
        "wallet.getEthereumProvider", // Para interactuar con wallets de Ethereum
        "actions.signIn", // Para autenticación de usuarios
        "actions.composeCast", // Para compartir atestaciones y logros
        "actions.viewProfile", // Para ver perfiles de usuarios
        "actions.viewCast", // Para ver casts relacionados
        "actions.ready", // Para inicialización del SDK
        "actions.openUrl", // Para abrir URLs externas
        "actions.close" // Para cerrar el mini app
      ]
    },
  };

  return Response.json(config);
}