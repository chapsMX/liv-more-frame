import { ethers } from "ethers";
import { DATA_SUFFIX } from "@/lib/builder-code";

/**
 * Hybrid signer for EAS SDK in Farcaster mini-apps.
 * - Reads (eth_call, getNonce, getNetwork, etc.) go through a public RPC provider
 * - Writes (sendTransaction) go through the Farcaster wallet signer
 * - ERC-8021 builder code is appended to calldata automatically on send,
 *   AFTER gas estimation (to avoid contract revert during estimateGas)
 */
export class HybridSigner extends ethers.AbstractSigner {
  private readProvider: ethers.JsonRpcProvider;
  private writeSigner: ethers.Signer;

  constructor(
    readProvider: ethers.JsonRpcProvider,
    writeSigner: ethers.Signer
  ) {
    super(readProvider);
    this.readProvider = readProvider;
    this.writeSigner = writeSigner;
  }

  async getAddress(): Promise<string> {
    return this.writeSigner.getAddress();
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    return this.writeSigner.signMessage(message);
  }

  async signTransaction(tx: ethers.TransactionRequest): Promise<string> {
    return this.writeSigner.signTransaction(tx);
  }

  async sendTransaction(
    tx: ethers.TransactionRequest
  ): Promise<ethers.TransactionResponse> {
    // Estimate gas with original calldata (no builder code) via public RPC
    if (!tx.gasLimit) {
      const estimate = await this.readProvider.estimateGas(tx);
      tx = { ...tx, gasLimit: (estimate * BigInt(130)) / BigInt(100) };
    }

    // Append ERC-8021 builder code AFTER gas estimation
    if (tx.data) {
      const hexData =
        typeof tx.data === "string" ? tx.data : ethers.hexlify(tx.data);
      tx = { ...tx, data: hexData + DATA_SUFFIX.slice(2) };
    }

    // Send via Farcaster wallet
    const response = await this.writeSigner.sendTransaction(tx);

    // Farcaster's provider doesn't support eth_getTransactionReceipt,
    // so re-fetch the tx from the public RPC for receipt polling via .wait()
    let rpcResponse: ethers.TransactionResponse | null = null;
    for (let i = 0; i < 60; i++) {
      rpcResponse = await this.readProvider.getTransaction(response.hash);
      if (rpcResponse) break;
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!rpcResponse) {
      throw new Error(
        `Transaction ${response.hash} not found on public RPC after sending`
      );
    }

    return rpcResponse;
  }

  async signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, unknown>
  ): Promise<string> {
    return this.writeSigner.signTypedData(domain, types, value);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  connect(_provider: ethers.Provider): HybridSigner {
    return this;
  }
}
