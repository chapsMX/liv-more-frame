export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_URL;

  const config = {
    accountAssociation: {
      "header": "eyJmaWQiOjEwMjA2NzcsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHhlOTc1OEY5NmQ0OUFkMjVkMTBlYjZENUU1ODg3MzEwMUNCRDcxNWQ0In0",
      "payload": "eyJkb21haW4iOiJhcHAubGl2bW9yZS5saWZlIn0",
      "signature": "MHhjNmMyYWJjNzZkZDBlNjdmNWZkNTllZGE2MjhiYzk2NjEwOGFjNjUzNjI5NzBmNDcxZGQ2NWZkMWYwNzU3NTMyMjA4ZGI2ZTc0NTIwMDYzMDAxZWYyNTVhOWRjM2IyMDkwYmQ1ZTVlNmJlNzg5ZDY2YmU1YmJiY2YyNDBhODBmYzFj"
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