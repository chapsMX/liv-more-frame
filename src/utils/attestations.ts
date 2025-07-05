import { EAS } from "@ethereum-attestation-service/eas-sdk";
import { BrowserProvider } from "ethers";
import { sdk } from "@farcaster/miniapp-sdk";

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

const EAS_CONTRACT_ADDRESS = '0x4200000000000000000000000000000000000021';

export async function submitDelegatedAttestation(attestationPayload: AttestationPayload) {
  console.log('🚀 Starting delegated attestation process with EAS SDK + Farcaster:', attestationPayload);
  
  // 1. Get Farcaster wallet provider
  const provider = await sdk.wallet.getEthereumProvider();
  if (!provider) {
    throw new Error('No Farcaster wallet provider found. Please connect your wallet in the Farcaster app.');
  }

  // 2. Get delegated signature from backend
  console.log('📝 Requesting delegated signature from backend...');
  const signResponse = await fetch('/api/attestations/delegated-sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(attestationPayload),
  });

  if (!signResponse.ok) {
    const errorData = await signResponse.json();
    console.error('❌ Backend signing failed:', errorData);
    throw new Error(errorData.error || 'Failed to get delegated signature');
  }

  const signResult = await signResponse.json();
  console.log('✅ Backend signature received:', {
    attester: signResult.attester,
    signature: signResult.signature,
    schema: signResult.delegatedAttestation.schema
  });

  // 3. Create EAS instance with Farcaster provider
  console.log('🔗 Connecting to EAS with Farcaster provider...');
  const browserProvider = new BrowserProvider(provider);
  const signer = await browserProvider.getSigner();
  
  const eas = new EAS(EAS_CONTRACT_ADDRESS);
  eas.connect(signer);

  console.log('✅ EAS connected with signer:', await signer.getAddress());

  // 4. Submit delegated attestation using EAS SDK
  console.log('⛓️ Submitting delegated attestation...');
  try {
    const tx = await eas.attestByDelegation({
      schema: signResult.delegatedAttestation.schema,
      data: {
        recipient: signResult.delegatedAttestation.recipient,
        expirationTime: BigInt(signResult.delegatedAttestation.expirationTime),
        revocable: signResult.delegatedAttestation.revocable,
        refUID: signResult.delegatedAttestation.refUID,
        data: signResult.encodedData,
        value: BigInt(signResult.delegatedAttestation.value),
      },
      signature: signResult.signature,
      attester: signResult.attester,
      deadline: BigInt(signResult.deadline || 0),
    });

    console.log('✅ Transaction sent! Details:', tx);
    console.log('🎯 Waiting for transaction confirmation...');

    // 5. Wait for transaction confirmation
    const attestationUID = await tx.wait();
    console.log('✅ Transaction confirmed');
    console.log('🎯 Attestation UID:', attestationUID);

    // 6. Verify the attestation exists
    console.log('🔍 Verifying attestation exists...');
    try {
      const attestation = await eas.getAttestation(attestationUID);
      if (!attestation) {
        console.error('❌ Attestation verification failed - not found');
        throw new Error('Attestation not found after creation');
      }
      console.log('✅ Attestation verified:', attestation);
    } catch (error) {
      console.error('❌ Attestation verification failed:', error);
      console.warn('⚠️ Continuing despite verification error - attestation may still be valid');
    }

    console.log('🎉 Attestation successfully created!');
    return attestationUID;
  } catch (error) {
    console.error('❌ Transaction failed:', error);
    
    // More specific error handling
    if (error instanceof Error) {
      if (error.message.includes('User rejected')) {
        throw new Error('Transaction was rejected by user');
      } else if (error.message.includes('insufficient funds')) {
        throw new Error('Insufficient funds for transaction');
      } else if (error.message.includes('nonce')) {
        throw new Error('Transaction nonce error - please try again');
      }
    }
    
    throw new Error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 