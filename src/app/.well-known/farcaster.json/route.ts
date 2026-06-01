export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_URL;

  const config = {
      "accountAssociation": {
        "header": "eyJmaWQiOjEwMjA2NzcsInR5cGUiOiJhdXRoIiwia2V5IjoiMHgwN0I1ZkQwNTc1QzAxQjZhY2JGMDg2RkNkRDRiODBGMjhlQzc0NDVCIn0",
        "payload": "eyJkb21haW4iOiJhcHAubGl2bW9yZS5saWZlIn0",
        "signature": "8cZt1c3t7BWc3uBQUgu4sKJyqrVUGy+mSO0RE8KFamlLLAkcCFer6QYzmHGvV8PPN91K0qSWXGRbc2iPWk3yqxw="
    },
    frame: {
      version: "1",
      name: "LivMore",
      iconUrl: `${appUrl}/icon.png`,
      homeUrl: appUrl,
      imageUrl: `${appUrl}/newHerorect.png`,
      buttonTitle: "LivMore 2.0",
      splashImageUrl: `${appUrl}/splash.png`,
      splashBackgroundColor: "#101827",
      webhookUrl: `https://api.neynar.com/f/app/51d0a8b5-4c69-4215-b709-ca9f4b8e7948/event`,
      subtitle: `One step at a time.`,
      description: `Tracking your healthy habits, one step at a time.`,
      primaryCategory: `health-fitness`,
      tags: [`health`, `biohacking`, `wearables`, `blockchain`, `challenges`],
      heroImageUrl: `${appUrl}/hero.png`,
      tagline: `One step at a time.`,
      ogTitle: `Liv More`,
      ogDescription: "Tracking your healthy habits, one step at a time.",
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