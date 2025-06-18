import type { NextApiRequest, NextApiResponse } from 'next';
import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';
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
      attesterAddress,
      // Raw data fields for encoding
      fid,
      name,
      display_name,
      wallet,
      metric_type,
      goal_value,
      actual_value,
      timestamp,
      challenge_id,
      title,
      description,
      image_url
    } = req.body;

    console.log('Received delegated sign request:', {
      schema,
      recipient,
      expirationTime,
      revocable,
      encodedDataLength: encodedData?.length,
      attesterAddress,
      hasRawData: !!(fid && metric_type)
    });

    // Validate required fields
    if (!schema || !recipient) {
      return res.status(400).json({ 
        error: 'Missing required fields: schema, recipient',
        received: { schema, recipient }
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
    
    console.log('Backend signer address (will be attester):', signerAddress);
    console.log('User recipient address:', recipient);

    // Handle data encoding
    let finalEncodedData = encodedData;
    
    // If no encodedData provided but we have raw data fields, encode them
    if (!encodedData && fid && metric_type) {
      console.log('Encoding raw data fields...');
      const schemaEncoder = new SchemaEncoder(
        "uint256 fid,string name,string display_name,address wallet,string metric_type,uint256 goal_value,uint256 actual_value,uint256 timestamp,string challenge_id,string title,string description,string image_url"
      );

      finalEncodedData = schemaEncoder.encodeData([
        { name: "fid", value: fid, type: "uint256" },
        { name: "name", value: name || "", type: "string" },
        { name: "display_name", value: display_name || "", type: "string" },
        { name: "wallet", value: wallet || recipient, type: "address" },
        { name: "metric_type", value: metric_type, type: "string" },
        { name: "goal_value", value: goal_value || 0, type: "uint256" },
        { name: "actual_value", value: actual_value || 0, type: "uint256" },
        { name: "timestamp", value: timestamp || Math.floor(Date.now() / 1000), type: "uint256" },
        { name: "challenge_id", value: challenge_id || "", type: "string" },
        { name: "title", value: title || "", type: "string" },
        { name: "description", value: description || "", type: "string" },
        { name: "image_url", value: image_url || "", type: "string" }
      ]);
      
      console.log('Data encoded successfully:', finalEncodedData.length, 'bytes');
    }

    if (!finalEncodedData) {
      return res.status(400).json({ 
        error: 'No data provided - either provide encodedData or raw data fields (fid, metric_type, etc.)'
      });
    }

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
      data: finalEncodedData,
      deadline: BigInt(0), // No deadline for signature
      value: BigInt(0)
    };

    console.log('Delegated attestation object for signing:', {
      schema: delegatedAttestation.schema,
      recipient: delegatedAttestation.recipient,
      expirationTime: delegatedAttestation.expirationTime.toString(),
      revocable: delegatedAttestation.revocable,
      refUID: delegatedAttestation.refUID,
      dataLength: finalEncodedData.length,
      deadline: delegatedAttestation.deadline.toString(),
      value: delegatedAttestation.value.toString(),
      signerWhoWillSign: signerAddress
    });

    console.log('Signing delegated attestation...');
    const response = await delegated.signDelegatedAttestation(
      delegatedAttestation,
      signer
    );

    console.log('Signature created successfully');

    // Return the same format as delegated-sign.ts
    return res.status(200).json({
      signature: response.signature,
      encodedData: finalEncodedData,
      delegatedAttestation: {
        schema: delegatedAttestation.schema,
        recipient: delegatedAttestation.recipient,
        expirationTime: delegatedAttestation.expirationTime.toString(),
        revocable: delegatedAttestation.revocable,
        refUID: delegatedAttestation.refUID,
        data: finalEncodedData,
        deadline: delegatedAttestation.deadline.toString(),
        value: delegatedAttestation.value.toString()
      },
      attester: signerAddress,
      deadline: "0"
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