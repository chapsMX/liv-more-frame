import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { OG_ABI, OG_CONTRACT_ADDRESS } from "./og-contract";

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

/**
 * Fetches the OG token SVG from the contract (on-chain).
 * Returns the raw SVG string or null if not found.
 */
export async function fetchOgTokenSvg(fid: number): Promise<string | null> {
  try {
    const tokenUri = await publicClient.readContract({
      address: OG_CONTRACT_ADDRESS,
      abi: OG_ABI,
      functionName: "tokenURI",
      args: [BigInt(fid)],
    });

    if (!tokenUri || typeof tokenUri !== "string") return null;

    if (tokenUri.startsWith("data:application/json;base64,")) {
      const b64 = tokenUri.slice("data:application/json;base64,".length);
      const jsonStr = Buffer.from(b64, "base64").toString("utf-8");
      const data = JSON.parse(jsonStr) as { image?: string };
      if (!data?.image) return null;

      if (data.image.startsWith("data:image/svg+xml;base64,")) {
        const svgB64 = data.image.slice("data:image/svg+xml;base64,".length);
        return Buffer.from(svgB64, "base64").toString("utf-8");
      }
    }
    return null;
  } catch {
    return null;
  }
}
