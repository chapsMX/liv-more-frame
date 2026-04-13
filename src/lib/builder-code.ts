import { Attribution } from "ox/erc8021";

/**
 * Base Builder Code for transaction attribution (ERC-8021).
 * Used to attribute onchain activity to LivMore in base.dev.
 * @see https://docs.base.org/base-chain/builder-codes/app-developers
 */
const BUILDER_CODE = process.env.NEXT_PUBLIC_BASE_BUILDER_CODE ?? "bc_2f4kjv4v";

export const DATA_SUFFIX = Attribution.toDataSuffix({
  codes: [BUILDER_CODE],
}) as `0x${string}`;
