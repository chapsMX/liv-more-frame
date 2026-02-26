/**
 * OG NFT mint contract (StepsOG).
 * Base Sepolia — chain id 84532.
 * (If your RPC uses 74532, set NEXT_PUBLIC_OG_CHAIN_ID=74532.)
 */
export const OG_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_OG_CONTRACT_ADDRESS as `0x${string}`) ||
  ("0xA3b171a6bB0EDb1C7Fce3A390abdDC32a9E29541" as `0x${string}`);

export const OG_CHAIN_ID = Number(process.env.NEXT_PUBLIC_OG_CHAIN_ID ?? "84532");

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
        internalType: "struct StepsOG.TokenData",
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
