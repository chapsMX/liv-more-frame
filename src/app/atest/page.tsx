'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sdk } from '@farcaster/frame-sdk';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { EAS, SchemaEncoder, NO_EXPIRATION } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from 'ethers';
import LoginButton from '@/components/LoginButton';
import { isAuthorizedForTesting } from '@/utils/auth';
// Arrow icon component
const ArrowLeft = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg"
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    className={className}
  >
    <path 
      d="M19 12H5M12 19L5 12L12 5" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

// EAS Attestation Component
function AttestationTester() {
  const { authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const activeWallet = wallets[0]; // Using first wallet as active
  const [isCreatingAttestation, setIsCreatingAttestation] = useState(false);
  const [attestationResult, setAttestationResult] = useState<{
    success: boolean;
    uid?: string;
    error?: string;
    txHash?: string;
  } | null>(null);

  // EAS Configuration
  const EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021";
  const SCHEMA_UID = "0xd4911f8070ea52111581b19a1b4de472903651e605bed55a5ffa688de7622034";
  const ZERO_UID =
    '0x0000000000000000000000000000000000000000000000000000000000000000';
  
  // Constant values as specified
  const ATTESTATION_DATA = {
    fid: 20701,
    name: "carlos",
    display_name: "chaps",
    metric_type: "Steps",
    goal_value: 10001,
    actual_value: 12385,
    challenge_id: "999",
    title: "Steps Goal Achieved",
    description: "User achieved daily goal",
    image_url: "https://tan-leading-pelican-169.mypinata.cloud/ipfs/bafkreidjr3w5yzdqhafqsaynss35kiwdqa4p42fkjpnjzdnx2thkubkxxq"
  };

  const createAttestation = async () => {
    if (!authenticated || !activeWallet) {
      setAttestationResult({
        success: false,
        error: "Wallet not connected"
      });
      return;
    }

    setIsCreatingAttestation(true);
    setAttestationResult(null);

    try {
      console.log("Starting attestation process...");
      
      // Get the Privy wallet provider first
      console.log("Getting Privy wallet provider...");
      const privyProvider = await activeWallet.getEthereumProvider();
      const provider = new ethers.BrowserProvider(privyProvider);
      const signer = await provider.getSigner();
      
      // Verificar la red del signer
      const network = await provider.getNetwork();
      console.log("Signer network:", network);
      
      const BASE_CHAIN_ID = 8453;
      if (Number(network.chainId) !== BASE_CHAIN_ID) {
        throw new Error("Please switch to Base network to create attestations");
      }

      // Initialize EAS with provider
      console.log("Creating EAS instance with contract:", EAS_CONTRACT_ADDRESS);
      const eas = new EAS(EAS_CONTRACT_ADDRESS);
      eas.connect(signer);

      // Initialize SchemaEncoder with the schema string
      console.log("Initializing SchemaEncoder...");
      const schemaEncoder = new SchemaEncoder(
        "uint256 fid,string name,string display_name,address wallet,string metric_type,uint256 goal_value,uint256 actual_value,uint256 timestamp,string challenge_id,string title,string description,string image_url"
      );

      const signerAddress = await signer.getAddress();
      console.log("Signer address:", signerAddress);

      // Encode the data
      console.log("Encoding attestation data...");
      const encodedData = schemaEncoder.encodeData([
        { name: "fid", value: ATTESTATION_DATA.fid, type: "uint256" },
        { name: "name", value: ATTESTATION_DATA.name, type: "string" },
        { name: "display_name", value: ATTESTATION_DATA.display_name, type: "string" },
        { name: "wallet", value: signerAddress, type: "address" },
        { name: "metric_type", value: ATTESTATION_DATA.metric_type, type: "string" },
        { name: "goal_value", value: ATTESTATION_DATA.goal_value, type: "uint256" },
        { name: "actual_value", value: ATTESTATION_DATA.actual_value, type: "uint256" },
        { name: "timestamp", value: Math.floor(Date.now() / 1000), type: "uint256" },
        { name: "challenge_id", value: ATTESTATION_DATA.challenge_id, type: "string" },
        { name: "title", value: ATTESTATION_DATA.title, type: "string" },
        { name: "description", value: ATTESTATION_DATA.description, type: "string" },
        { name: "image_url", value: ATTESTATION_DATA.image_url, type: "string" }
      ]);

      // Get the signature from backend
      console.log("Getting signature from backend...");
      const signResponse = await fetch('/api/attestations/delegated-sign-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema: SCHEMA_UID,
          recipient: signerAddress,
          expirationTime: '0',
          revocable: false,
          data: encodedData,
          attesterAddress: signerAddress,
        }),
      });

      if (!signResponse.ok) {
        const errorText = await signResponse.text();
        console.error("Backend signature error:", errorText);
        throw new Error(`Failed to get signature: ${signResponse.statusText}. ${errorText}`);
      }

      const { signature, attester } = await signResponse.json();
      
      console.log("Got signature from backend:", {
        signature,
        attester,
        signerAddress
      });

      // Validar que el attester sea el correcto
      if (attester.toLowerCase() !== "0xf1D37083cbdf0a5a0735D666e2634e7BBBADe38f".toLowerCase()) {
        throw new Error("Invalid attester address from backend");
      }

      // Create the attestation
      console.log("Creating attestation with data:", {
        schema: SCHEMA_UID,
        recipient: signerAddress,
        attester: attester,
        hasSignature: !!signature
      });
      
      const tx = await eas.attestByDelegation({
        schema: SCHEMA_UID,
        data: {
          recipient: signerAddress,
          expirationTime: NO_EXPIRATION,
          revocable: false,
          refUID: ZERO_UID,
          data: encodedData,
          value: BigInt(0),
        },
        signature,
        attester,
        deadline: NO_EXPIRATION
      });

      console.log("Transaction sent:", {
        data: tx.data,
        from: await signer.getAddress(),
        to: EAS_CONTRACT_ADDRESS
      });
      
      // Wait for transaction confirmation
      console.log("Waiting for transaction confirmation...");
      const newAttestationUID = await tx.wait();
      
      console.log("New attestation UID:", newAttestationUID);
      console.log("Transaction receipt:", tx.receipt);

      setAttestationResult({
        success: true,
        uid: newAttestationUID,
        txHash: tx.receipt?.hash
      });

    } catch (error) {
      console.error("Error creating attestation:", error);
      setAttestationResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    } finally {
      setIsCreatingAttestation(false);
    }
  };

  if (!ready) {
    return (
      <div className="bg-white rounded-lg p-1 border border-gray-200">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Privy...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="bg-white rounded-lg p-1 border border-gray-200">
        <div className="text-center">
          <h4 className="text-lg font-semibold text-gray-900 mb-2">EAS Attestations</h4>
          <p className="text-gray-600 text-sm">
            Please connect your wallet first to create attestations
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-1 border border-gray-200">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-gray-900">EAS Attestations</h4>
          <div className="text-xs text-gray-500">Base Network</div>
        </div>

        {/* Attestation Data Preview */}
        <div className="bg-gray-50 rounded-lg p-2">
          <h5 className="font-medium text-gray-900 mb-2">Attestation Data Preview</h5>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-gray-600">FID:</span> {ATTESTATION_DATA.fid}</div>
            <div><span className="text-gray-600">Name:</span> {ATTESTATION_DATA.name}</div>
            <div><span className="text-gray-600">Display Name:</span> {ATTESTATION_DATA.display_name}</div>
            <div><span className="text-gray-600">Wallet:</span> {activeWallet?.address.slice(0, 6)}...{activeWallet?.address.slice(-4)}</div>
            <div><span className="text-gray-600">Metric:</span> {ATTESTATION_DATA.metric_type}</div>
            <div><span className="text-gray-600">Goal:</span> {ATTESTATION_DATA.goal_value.toLocaleString()}</div>
            <div><span className="text-gray-600">Achieved:</span> {ATTESTATION_DATA.actual_value.toLocaleString()}</div>
            <div><span className="text-gray-600">Challenge:</span> {ATTESTATION_DATA.challenge_id}</div>
          </div>
          <div className="mt-2 text-sm">
            <div><span className="text-gray-600">Title:</span> {ATTESTATION_DATA.title}</div>
            <div><span className="text-gray-600">Description:</span> {ATTESTATION_DATA.description}</div>
          </div>
        </div>

        {/* Create Attestation Button */}
        <button
          onClick={createAttestation}
          disabled={isCreatingAttestation}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isCreatingAttestation ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Creating Attestation...
            </>
          ) : (
            <>
              <span>🏆</span>
              Create EAS Attestation
            </>
          )}
        </button>

        {/* Results */}
        {attestationResult && (
          <div className={`p-4 rounded-lg border ${
            attestationResult.success 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            {attestationResult.success ? (
              <div className="space-y-2">
                <p className="text-sm text-green-800 font-medium">
                  ✅ Attestation created successfully!
                </p>
                {attestationResult.uid && (
                  <div className="text-xs text-green-700">
                    <div><strong>UID:</strong> {attestationResult.uid}</div>
                  </div>
                )}
                {attestationResult.txHash && (
                  <div className="text-xs text-green-700">
                    <div><strong>TX Hash:</strong> {attestationResult.txHash}</div>
                  </div>
                )}
                {attestationResult.uid && (
                  <a
                    href={`https://base.easscan.org/attestation/view/${attestationResult.uid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
                  >
                    View on EAS Scan →
                  </a>
                )}
              </div>
            ) : (
              <div>
                <p className="text-sm text-red-800 font-medium">
                  ❌ Error creating attestation
                </p>
                <p className="text-xs text-red-700 mt-1">
                  {attestationResult.error}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Schema Info */}
        <div className="text-xs text-gray-500 space-y-1">
          <div><strong>Contract:</strong> {EAS_CONTRACT_ADDRESS}</div>
          <div><strong>Schema:</strong> {SCHEMA_UID}</div>
        </div>
      </div>
    </div>
  );
}

export default function AtestPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [userFid, setUserFid] = useState<number | null>(null);

  useEffect(() => {
    const checkAuthorization = async () => {
      try {
        // Get user context from Farcaster SDK
        const context = await sdk.context;
        const fid = context.user?.fid;
        
        setUserFid(fid || null);
        
        // Check if user is authorized using the utility function
        if (isAuthorizedForTesting(fid)) {
          setIsAuthorized(true);
          sdk.actions.ready(); // Hide splash screen
        } else {
          setIsAuthorized(false);
        }
      } catch (error) {
        console.error('Error checking authorization:', error);
        setIsAuthorized(false);
      }
    };

    checkAuthorization();
  }, []);

  const handleBack = () => {
    router.back();
  };

  // Loading state
  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // Unauthorized access
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🚫</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Acceso Restringido
            </h1>
            <p className="text-gray-600">
              Esta página está disponible solo para usuarios autorizados.
            </p>
            {userFid && (
              <p className="text-sm text-gray-500 mt-2">
                Tu FID: {userFid}
              </p>
            )}
          </div>
          
          <button
            onClick={handleBack}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <ArrowLeft size={20} />
            Volver
          </button>
        </div>
      </div>
    );
  }

  // Authorized access - Test page content
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-1 py-1">
          <div className="flex items-center gap-2">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <ArrowLeft size={24} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Atest</h1>
              <p className="text-sm text-gray-600">Página de pruebas - FID {userFid}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-2 py-2">
        <div className="bg-white rounded-2xl shadow-xl p-1">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🧪</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Página de Pruebas
            </h2>
            <p className="text-gray-600 max-w-md mx-auto">
              Bienvenido a la página de pruebas de LivMore. Aquí puedes realizar 
              experimentos y pruebas de funcionalidades.
            </p>
          </div>

          {/* Test Area */}
          <div className="bg-gray-50 rounded-xl p-2 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Área de Pruebas - Privy Integration
            </h3>
            <div className="grid gap-4">
              <LoginButton />
              <AttestationTester />
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-2">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-sm">ℹ️</span>
              </div>
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">
                  Información de la Sesión
                </h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Usuario autorizado: FID {userFid}</li>
                  <li>• Contexto: Farcaster Mini App</li>
                  <li>• Estado: Conectado y verificado</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 