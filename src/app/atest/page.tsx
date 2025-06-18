'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sdk } from '@farcaster/frame-sdk';
import { isAuthorizedForTesting } from '@/utils/auth';
import { createWalletClient, custom, encodeFunctionData, parseAbi } from 'viem';
import { base } from 'viem/chains';

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

// EAS Configuration
const EAS_CONTRACT_ADDRESS = '0x4200000000000000000000000000000000000021';
const SCHEMA_UID = "0xd4911f8070ea52111581b19a1b4de472903651e605bed55a5ffa688de7622034";

// ABI for attestByDelegation function
const ABI = parseAbi([
  'function attestByDelegation((bytes32 schema,address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value),bytes signature,address attester,uint64 deadline) returns (bytes32)'
]);

// Attestation Tester Component using viem (Farcaster wallet compatible)
function AttestationTester() {
  const [isCreatingAttestation, setIsCreatingAttestation] = useState(false);
  const [isWaitingForWallet, setIsWaitingForWallet] = useState(false);
  const [attestationResult, setAttestationResult] = useState<{
    success: boolean;
    error?: string;
    txHash?: string;
  } | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Constant values for testing
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

  // Connect wallet using Farcaster SDK with viem
  const connectWallet = async () => {
    try {
      console.log("Attempting to connect wallet using Farcaster SDK...");
      
      // Get Ethereum provider from Farcaster SDK
      console.log("Getting Ethereum provider from Farcaster SDK...");
      const provider = await sdk.wallet.getEthereumProvider();
      console.log("Provider obtained:", !!provider);

      if (!provider) {
        throw new Error("No Ethereum provider available from Farcaster SDK");
      }

      // Create wallet client with Farcaster provider
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(provider)
      });

      const [address] = await walletClient.getAddresses();
      
      console.log("Connected account:", address);
      setWalletAddress(address);
      return address;
    } catch (error) {
      console.error("Error connecting wallet:", error);
      throw error;
    }
  };

  const createAttestation = async () => {
    setIsCreatingAttestation(true);
    setAttestationResult(null);

    try {
      console.log("Starting attestation process...");
      
      // 1. Connect wallet if not connected
      let recipient = walletAddress;
      if (!recipient) {
        console.log("Wallet not connected, connecting now...");
        recipient = await connectWallet();
        console.log("Wallet connected, address:", recipient);
      } else {
        console.log("Using existing wallet address:", recipient);
      }

      // Verify we have a valid recipient
      if (!recipient) {
        throw new Error("Failed to get wallet address");
      }

      // 3. Prepare attestation payload
      const attestationPayload = {
        schema: SCHEMA_UID,
        recipient: recipient, // User wallet that will receive the attestation
        expirationTime: '0',
        revocable: false,
        // Raw data for backend encoding
        fid: ATTESTATION_DATA.fid,
        name: ATTESTATION_DATA.name,
        display_name: ATTESTATION_DATA.display_name,
        wallet: recipient,
        metric_type: ATTESTATION_DATA.metric_type,
        goal_value: ATTESTATION_DATA.goal_value,
        actual_value: ATTESTATION_DATA.actual_value,
        timestamp: Math.floor(Date.now() / 1000),
        challenge_id: ATTESTATION_DATA.challenge_id,
        title: ATTESTATION_DATA.title,
        description: ATTESTATION_DATA.description,
        image_url: ATTESTATION_DATA.image_url
      };

      console.log("Attestation payload:", attestationPayload);

      // 4. Get delegated signature from backend
      console.log("Getting delegated signature from backend...");
      const signResponse = await fetch('/api/attestations/delegated-sign-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attestationPayload),
      });

      if (!signResponse.ok) {
        const errorData = await signResponse.json();
        throw new Error(errorData.error || 'Failed to get delegated signature');
      }

      const signResult = await signResponse.json();
      console.log("Backend response:", signResult);

       // 5. Create attestation using viem (based on submitDelegatedAttestation pattern)
       console.log("Creating attestation with viem...");
       
       // Get Farcaster provider
       const provider = await sdk.wallet.getEthereumProvider();
       if (!provider) {
         throw new Error("No Ethereum provider available from Farcaster SDK");
       }

       // Create wallet client with Farcaster provider
       const walletClient = createWalletClient({
         chain: base,
         transport: custom(provider)
       });

       const [account] = await walletClient.getAddresses();
       console.log("Using account:", account);

       // 6. Encode data for 'attestByDelegation' call
       console.log("Encoding function data...");
       const data = encodeFunctionData({
         abi: ABI,
         functionName: 'attestByDelegation',
         args: [
           {
             schema: signResult.delegatedAttestation.schema,
             recipient: signResult.delegatedAttestation.recipient,
             expirationTime: BigInt(signResult.delegatedAttestation.expirationTime),
             revocable: signResult.delegatedAttestation.revocable,
             refUID: signResult.delegatedAttestation.refUID,
             data: signResult.delegatedAttestation.data || signResult.encodedData,
             value: BigInt(signResult.delegatedAttestation.value),
           },
           signResult.signature,
           signResult.attester, // Backend signer who signed the attestation
           BigInt(signResult.deadline || 0)
         ]
       });

       console.log("Function data encoded successfully");

       // 7. Send transaction from user's wallet
       console.log("Sending transaction...");
       setIsWaitingForWallet(true);
       
       const txHash = await walletClient.sendTransaction({
         account,
         to: EAS_CONTRACT_ADDRESS,
         data,
         value: BigInt(0)
       });

       console.log("Transaction sent successfully:", txHash);
       setIsWaitingForWallet(false);

       setAttestationResult({
         success: true,
         txHash: txHash
       });

    } catch (error) {
      console.error("Error creating attestation:", error);
      setIsWaitingForWallet(false);
      setAttestationResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    } finally {
      setIsCreatingAttestation(false);
    }
  };

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-gray-900">EAS Attestations (viem)</h4>
          <div className="text-xs text-gray-500">Base Network</div>
        </div>

        {/* Wallet Connection Status */}
        <div className="bg-gray-50 rounded-lg p-3">
          <h5 className="font-medium text-gray-900 mb-2">Wallet Status</h5>
          {walletAddress ? (
            <div className="text-sm text-green-700">
              ✅ Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-gray-600">
                🔌 Not connected
              </div>
              <button
                onClick={connectWallet}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          )}
        </div>

        {/* Attestation Data Preview */}
        <div className="bg-gray-50 rounded-lg p-3">
          <h5 className="font-medium text-gray-900 mb-2">Attestation Data Preview</h5>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-gray-600">FID:</span> {ATTESTATION_DATA.fid}</div>
            <div><span className="text-gray-600">Name:</span> {ATTESTATION_DATA.name}</div>
            <div><span className="text-gray-600">Display Name:</span> {ATTESTATION_DATA.display_name}</div>
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

        {/* Process Explanation */}
        <div className="bg-blue-50 rounded-lg p-3">
          <h5 className="font-medium text-blue-900 mb-2">Process Flow</h5>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>1. 🔐 Backend signs attestation data delegated</li>
            <li>2. 🌐 Connect to Farcaster Wallet</li>
            <li>3. 📝 Encode attestByDelegation with viem</li>
            <li>4. 📤 Send transaction via Farcaster Wallet</li>
          </ol>
        </div>

        {/* Wallet Warning */}
        <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
          <h5 className="font-medium text-yellow-900 mb-2">⚠️ Wallet Notice</h5>
          <div className="text-sm text-yellow-800 space-y-1">
            <p><strong>Coinbase Wallet may show:</strong> "Transaction preview unavailable"</p>
            <p><strong>This is normal</strong> for EAS attestation transactions.</p>
            <p><strong>Safe to proceed:</strong> The transaction is properly formed and secure.</p>
          </div>
        </div>

        {/* Create Attestation Button */}
        <button
          onClick={createAttestation}
          disabled={isCreatingAttestation || isWaitingForWallet}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isWaitingForWallet ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Waiting for Wallet Confirmation...
            </>
          ) : isCreatingAttestation ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Creating Attestation...
            </>
          ) : (
            <>
              <span>🏆</span>
              Create EAS Attestation (viem)
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
                  ✅ Attestation transaction sent successfully!
                </p>
                {attestationResult.txHash && (
                  <div className="text-xs text-green-700">
                    <div><strong>TX Hash:</strong> {attestationResult.txHash}</div>
                    <a
                      href={`https://basescan.org/tx/${attestationResult.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
                    >
                      View on BaseScan →
                    </a>
                  </div>
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
              experimentos y pruebas de funcionalidades usando EAS SDK con Farcaster Wallet.
            </p>
          </div>

          {/* Test Area */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Área de Pruebas - viem + Farcaster Wallet
            </h3>
            <AttestationTester />
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
                  <li>• Wallet: Farcaster Wallet (viem)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 