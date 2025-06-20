import { EAS } from "@ethereum-attestation-service/eas-sdk";
import { BrowserProvider } from "ethers";
import type { TransactionReceipt } from "ethers";

interface AttestationPayload {
  fid: number;
  name: string;
  display_name: string;
  wallet: string;
  metric_type: string;
  goal_value: number;
  actual_value: number;
  timestamp: number;
  challenge_id: string;
  title: string;
  description: string;
  image_url: string;
}

const EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021";

const BASE_CHAIN_ID = '0x2105'; // 8453 in hex
const BASE_PARAMS = {
  chainId: BASE_CHAIN_ID,
  chainName: 'Base Mainnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org'],
};

const ensureBaseNetwork = async () => {
  if (!window.ethereum) throw new Error('No crypto wallet found');
  const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (currentChainId !== BASE_CHAIN_ID) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_CHAIN_ID }],
      });
    } catch (switchError: unknown) {
      if (typeof switchError === 'object' && switchError !== null && 'code' in switchError && switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [BASE_PARAMS],
        });
      } else {
        throw switchError;
      }
    }
  }
};

export async function submitDelegatedAttestation(attestationPayload: AttestationPayload) {
  // 1. Ensure we're on Base network
  await ensureBaseNetwork();

  // 2. Get delegated signature from backend
  const signResponse = await fetch('/api/attestations/delegated-sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(attestationPayload),
  });

  if (!signResponse.ok) {
    const errorData = await signResponse.json();
    throw new Error(errorData.error || 'Failed to get delegated signature');
  }

  const signResult = await signResponse.json();

  // 3. Initialize EAS contract with ethers
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  const eas = new EAS(EAS_CONTRACT_ADDRESS);
  eas.connect(signer);

  // 4. Create attestation
  const tx = await eas.attestByDelegation({
    schema: signResult.delegatedAttestation.schema,
    data: {
      recipient: signResult.delegatedAttestation.recipient,
      expirationTime: BigInt(signResult.delegatedAttestation.expirationTime),
      revocable: signResult.delegatedAttestation.revocable,
      refUID: signResult.delegatedAttestation.refUID,
      data: signResult.encodedData
    },
    signature: signResult.signature,
    attester: signResult.attester,
    deadline: BigInt(signResult.deadline)
  });

  // 5. Wait for transaction
  const receipt = await tx.wait() as unknown as TransactionReceipt;
  console.log('Attestation transaction receipt:', receipt);

  // 6. Get attestation UID from transaction
  const attestationUID = receipt.toString();
  console.log('Attestation UID:', attestationUID);

  // 7. Verify the attestation exists
  const attestation = await eas.getAttestation(attestationUID);
  if (!attestation) {
    throw new Error('Attestation not found after creation');
  }

  return attestationUID;
} 