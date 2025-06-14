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

    if (!fid || !wallet || !metric_type || !goal_value || !actual_value || !timestamp) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const provider = new JsonRpcProvider(BASE_RPC_URL);
    const signer = new Wallet(PRIVATE_KEY, provider);
    const eas = new EAS(EAS_CONTRACT_ADDRESS);
    eas.connect(signer);
    const delegated = await eas.getDelegated();

    const schemaEncoder = new SchemaEncoder("uint256 fid,string name,string display_name,address wallet,string metric_type,uint256 goal_value,uint256 actual_value,uint256 timestamp,string challenge_id,string title,string description,string image_url");
    const encodedData = schemaEncoder.encodeData([
      { name: "fid", value: String(fid), type: "uint256" },
      { name: "name", value: name || "", type: "string" },
      { name: "display_name", value: display_name || "", type: "string" },
      { name: "wallet", value: wallet, type: "address" },
      { name: "metric_type", value: metric_type, type: "string" },
      { name: "goal_value", value: String(goal_value), type: "uint256" },
      { name: "actual_value", value: String(actual_value), type: "uint256" },
      { name: "timestamp", value: String(timestamp), type: "uint256" },
      { name: "challenge_id", value: challenge_id || "", type: "string" },
      { name: "title", value: title || "", type: "string" },
      { name: "description", value: description || "", type: "string" },
      { name: "image_url", value: image_url || "", type: "string" }
    ]);

    const delegatedAttestation = {
      schema: SCHEMA_UID,
      recipient: wallet,
      expirationTime: BigInt(0),
      revocable: false,
      refUID: ZERO_UID,
      data: encodedData,
      deadline: BigInt(0),
      value: BigInt(0)
    };

    const response = await delegated.signDelegatedAttestation(
      delegatedAttestation,
      signer
    );

    return res.status(200).json({
      signature: response.signature,
      encodedData,
      delegatedAttestation: {
        ...delegatedAttestation,
        expirationTime: delegatedAttestation.expirationTime.toString(),
        deadline: delegatedAttestation.deadline.toString(),
        value: delegatedAttestation.value.toString()
      },
      attester: await signer.getAddress(),
      deadline: "0"
    });
  } catch (error: unknown) {
    console.error('Delegated attestation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({ error: errorMessage });
  }
} 