/**
 * OG NFT mint contract (LivMoreOG).
 * Base mainnet — chain id 8453.
 */
export const OG_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_OG_CONTRACT_ADDRESS as `0x${string}`) ||
  ("0x73590BCC99a8E334454C08858da91d1e869558B9" as `0x${string}`);

export const OG_CHAIN_ID = Number(process.env.NEXT_PUBLIC_OG_CHAIN_ID ?? "8453");

export const OG_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "fid", type: "uint256" },
      { internalType: "string", name: "username", type: "string" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
      { internalType: "bytes", name: "signature", type: "bytes" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "fid", type: "uint256" }],
    name: "isFidMinted",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "fid", type: "uint256" }],
    name: "getTokenData",
    outputs: [
      {
        components: [
          { internalType: "string", name: "username", type: "string" },
          { internalType: "uint256", name: "mintTimestamp", type: "uint256" },
          { internalType: "uint256", name: "seed", type: "uint256" },
        ],
        internalType: "struct LivMoreOG.TokenData",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
