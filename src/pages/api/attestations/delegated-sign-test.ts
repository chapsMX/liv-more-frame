import type { NextApiRequest, NextApiResponse } from 'next';
import { EAS } from '@ethereum-attestation-service/eas-sdk';
import { Wallet, JsonRpcProvider } from 'ethers';

const EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021";
const SCHEMA_UID = "0xd4911f8070ea52111581b19a1b4de472903651e605bed55a5ffa688de7622034";
const BASE_RPC_URL = 'https://mainnet.base.org';
const ZERO_UID = '0x0000000000000000000000000000000000000000000000000000000000000000';

// WARNING: Store your private key securely, e.g. in environment variables
const PRIVATE_KEY = process.env.EAS_SIGNER_PRIVATE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      schema,
      recipient,
      expirationTime,
      revocable,
      data: encodedData,
      attesterAddress
    } = req.body;

    console.log('Received delegated sign request:', {
      schema,
      recipient,
      expirationTime,
      revocable,
      encodedDataLength: encodedData?.length,
      attesterAddress
    });

    // Validate required fields
    if (!schema || !recipient || !encodedData || !attesterAddress) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        received: { schema, recipient, encodedData: !!encodedData, attesterAddress }
      });
    }

    // Validate schema matches
    if (schema !== SCHEMA_UID) {
      return res.status(400).json({ 
        error: 'Invalid schema UID',
        expected: SCHEMA_UID,
        received: schema
      });
    }

    if (!PRIVATE_KEY) {
      return res.status(500).json({ error: 'EAS_SIGNER_PRIVATE_KEY not configured' });
    }

    console.log('Setting up provider and signer...');
    const provider = new JsonRpcProvider(BASE_RPC_URL);
    const signer = new Wallet(PRIVATE_KEY, provider);
    const signerAddress = await signer.getAddress();
    
    console.log('Signer address:', signerAddress);
    console.log('Attester address:', attesterAddress);

    const eas = new EAS(EAS_CONTRACT_ADDRESS);
    await eas.connect(signer);
    const delegated = await eas.getDelegated();

    console.log('Creating delegated attestation object...');
    
    // Convert expirationTime to BigInt, handling string/number/BigInt inputs
    let expTime: bigint;
    if (typeof expirationTime === 'string') {
      expTime = BigInt(expirationTime);
    } else if (typeof expirationTime === 'number') {
      expTime = BigInt(expirationTime);
    } else if (typeof expirationTime === 'bigint') {
      expTime = expirationTime;
    } else {
      expTime = BigInt(0);
    }
    
    const delegatedAttestation = {
      schema: SCHEMA_UID,
      recipient: recipient,
      expirationTime: expTime,
      revocable: revocable || false,
      refUID: ZERO_UID,
      data: encodedData,
      deadline: BigInt(0), // No deadline for signature
      value: BigInt(0)
    };

    console.log('Signing delegated attestation...');
    const response = await delegated.signDelegatedAttestation(
      delegatedAttestation,
      signer
    );

    console.log('Signature created successfully');

    return res.status(200).json({
      signature: response.signature,
      attester: signerAddress, // The backend signer is the attester
      deadline: "0", // No deadline
      delegatedAttestation: {
        ...delegatedAttestation,
        expirationTime: delegatedAttestation.expirationTime.toString(),
        deadline: delegatedAttestation.deadline.toString(),
        value: delegatedAttestation.value.toString()
      }
    });

  } catch (error: unknown) {
    console.error('Delegated attestation signing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({ 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
  }
} 