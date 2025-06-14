import type { NextApiRequest, NextApiResponse } from 'next';
import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';
import { Wallet, JsonRpcProvider } from 'ethers';

const EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021";
const SCHEMA_UID = "0xd4911f8070ea52111581b19a1b4de472903651e605bed55a5ffa688de7622034";
const BASE_RPC_URL = 'https://mainnet.base.org';

// WARNING: Store your private key securely, e.g. in environment variables
const PRIVATE_KEY = process.env.EAS_SIGNER_PRIVATE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
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

    // Validate required fields
    if (!fid || !wallet || !metric_type || !goal_value || !actual_value || !timestamp) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Setup signer and EAS
    const provider = new JsonRpcProvider(BASE_RPC_URL);
    const signer = new Wallet(PRIVATE_KEY, provider);
    const eas = new EAS(EAS_CONTRACT_ADDRESS);
    eas.connect(signer);

    // Encode data
    const schemaEncoder = new SchemaEncoder("uint256 fid,string name,string display_name,address wallet,string metric_type,uint256 goal_value,uint256 actual_value,uint256 timestamp,string challenge_id,string title,string description,string image_url");
    const encodedData = schemaEncoder.encodeData([
      { name: "fid", value: BigInt(fid), type: "uint256" },
      { name: "name", value: name || "", type: "string" },
      { name: "display_name", value: display_name || "", type: "string" },
      { name: "wallet", value: wallet, type: "address" },
      { name: "metric_type", value: metric_type, type: "string" },
      { name: "goal_value", value: BigInt(goal_value), type: "uint256" },
      { name: "actual_value", value: BigInt(actual_value), type: "uint256" },
      { name: "timestamp", value: BigInt(timestamp), type: "uint256" },
      { name: "challenge_id", value: challenge_id || "", type: "string" },
      { name: "title", value: title || "", type: "string" },
      { name: "description", value: description || "", type: "string" },
      { name: "image_url", value: image_url || "", type: "string" }
    ]);

    // Send attestation
    const tx = await eas.attest({
      schema: SCHEMA_UID,
      data: {
        recipient: wallet,
        expirationTime: BigInt(0),
        revocable: false,
        data: encodedData,
      },
    });
    const newAttestationUID = await tx.wait();
    return res.status(200).json({ attestationUID: newAttestationUID });
  } catch (error: unknown) {
    console.error('EAS attestation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({ error: errorMessage });
  }
} 