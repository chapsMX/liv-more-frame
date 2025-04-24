"use client";

import { useEffect, useState, useCallback } from "react";
import sdk, {
AddFrame,
type Context,
} from "@farcaster/frame-sdk";
import { useRouter } from "next/navigation";

import { Boton } from "../styles/ui/boton";
import { protoMono } from '../styles/fonts';
import Image from 'next/image';
import { CaloriesIcon, StepsIcon, SleepIcon } from '../styles/svg/index';
import '../styles/footer.css';
import Loader from './Loader';

interface WhitelistResponse {
  isWhitelisted: boolean;
  canUse: boolean;
  accepted_tos: boolean;
  accepted_privacy_policy: boolean;
}

export default function LivMore() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [added, setAdded] = useState(false);
  const [addFrameResult, setAddFrameResult] = useState("");
  const [whitelistInfo, setWhitelistInfo] = useState("");
  const [isWhitelisted, setIsWhitelisted] = useState<boolean | null>(null);
  const [canUse, setCanUse] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPopup, setShowPopup] = useState(false);
  const [showJustFrameItPopup, setShowJustFrameItPopup] = useState(true);
  const [countdown, setCountdown] = useState(10);
  const [isTermsChecked, setIsTermsChecked] = useState(false);
  const router = useRouter();

  const checkWhitelistStatus = useCallback(async () => {
    try {
      if (!context?.user?.fid) {
        console.log('FID no disponible en el contexto');
        setIsWhitelisted(false);
        setCanUse(false);
        setIsLoading(false);
        return;
      }

      console.log('Consultando whitelist con FID:', context.user.fid);
      const response = await fetch(`/api/whitelist/check?fid=${context.user.fid}`);
      const data: WhitelistResponse = await response.json();
      console.log('Datos recibidos del endpoint:', data);
      
      setIsWhitelisted(data.isWhitelisted);
      setCanUse(data.canUse);
      
      // Si el usuario ya aceptó los términos, redirigir al dashboard
      if (data.accepted_tos && data.accepted_privacy_policy) {
        console.log('Usuario ya aceptó los términos, redirigiendo al dashboard...');
        router.push('/dashboard');
      } else {
        console.log('Usuario no ha aceptado los términos o no están completos:', {
          accepted_tos: data.accepted_tos,
          accepted_privacy_policy: data.accepted_privacy_policy
        });
      }
    } catch (error) {
      console.error('Error checking whitelist status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [context?.user?.fid, router]);

  const handleEarlyAccess = async () => {
    try {
      if (!context?.user?.fid) {
        setWhitelistInfo("No user FID found");
        return;
      }

      const response = await fetch(`/api/neynar?fid=${context.user.fid}`);
      const data = await response.json();

      if (!data.success) {
        setWhitelistInfo(`Error: ${data.error}`);
        return;
      }

      const { username, display_name, custody_address } = data.user;
      
      // Guardar en la base de datos
      const whitelistResponse = await fetch('/api/whitelist/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_fid: context.user.fid,
          username,
          eth_address: custody_address,
          display_name,
          accepted_tos: true,
          accepted_privacy_policy: true
        }),
      });

      const whitelistData = await whitelistResponse.json();

      if (whitelistData.success) {
        setWhitelistInfo(
          `✨ ¡Welcome ${username}!\n` +
          `🎉 You have been added to the Wait list.\n` +
          `⏳ Redirecting to share page in ${countdown}s...`
        );

        // Mostrar popup
        setShowPopup(true);

        // Iniciar countdown
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              setShowPopup(false);
              // Recargar inmediatamente
              window.location.reload();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        // Añadir el frame
        const result = await sdk.actions.addFrame();
        if (result.notificationDetails) {
          setAddFrameResult(
            `✅ Frame added successfully\n` +
            `🔔 Token: ${result.notificationDetails.token}\n` +
            `🔗 URL: ${result.notificationDetails.url}`
          );
        }
      } else {
        setWhitelistInfo(`Error adding to Wait list: ${whitelistData.error}`);
      }
    } catch (error) {
      if (error instanceof AddFrame.RejectedByUser) {
        setAddFrameResult(`❌ Frame no añadido: ${error.message}`);
      } else if (error instanceof AddFrame.InvalidDomainManifest) {
        setAddFrameResult(`❌ Frame no añadido: ${error.message}`);
      } else {
        setWhitelistInfo(`Error: ${error}`);
      }
    }
  };

  const handleUpdateTerms = async () => {
    try {
      if (!context?.user?.fid) {
        console.error('No user FID found');
        return;
      }

      const response = await fetch('/api/whitelist/update-terms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_fid: context.user.fid,
          accepted_tos: true,
          accepted_privacy_policy: true
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.replace('/dashboard');
      } else {
        console.error('Error updating terms:', data.error);
      }
    } catch (error) {
      console.error('Error updating terms:', error);
    }
  };

  // contexto del frame
  useEffect(() => {
    const load = async () => {
      try {
        console.log("Iniciando carga del SDK");
        const context = await sdk.context;
        console.log("Contexto obtenido:", context);
        setContext(context);
        setAdded(context.client.added);

        // Verificar whitelist si tenemos el FID
        if (context.user?.fid) {
          console.log("FID disponible:", context.user.fid);
          await checkWhitelistStatus();
        } else {
          console.log("Esperando FID...");
          setIsLoading(false);
        }

        sdk.on("frameAddRejected", ({ reason }) => {
          console.log(`Frame add rejected: ${reason}`);
        });

        sdk.on("frameRemoved", () => {
          setAdded(false);
        });

        sdk.on("primaryButtonClicked", () => {
          console.log("primaryButtonClicked");
        });

        console.log("Calling ready");
        sdk.actions.ready({});
      } catch (error) {
        console.error("Error al cargar el SDK:", error);
        setIsLoading(false);
      }
    };

    if (sdk && !isSDKLoaded) {
      console.log("Iniciando SDK");
      setIsSDKLoaded(true);
      load();
      return () => {
        sdk.removeAllListeners();
      };
    }
  }, [isSDKLoaded, checkWhitelistStatus]);

  // Efecto para verificar whitelist cuando el contexto cambia
  useEffect(() => {
    if (context?.user?.fid) {
      console.log("Contexto actualizado, verificando whitelist");
      checkWhitelistStatus();
    }
  }, [context?.user?.fid, checkWhitelistStatus]);

  const handleShare = async () => {
    try {
      const text = "I joined the waitlist for @livmore 🧬 🧬";
      const url = "https://app.livmore.life";
      
      await sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(url)}`);
    } catch (error) {
      console.error('Error sharing frame:', error);
    }
  };

  if (isLoading) {
    return <Loader message="Initializing..." />;
  }

  // Si el usuario está en whitelist y puede usar la app pero no ha aceptado los términos
  if (isWhitelisted && canUse) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex flex-col">
        <main className="flex-1 flex items-center justify-center p-2">
          <div className="flex flex-col items-center gap-6">
            <Image
              src="/livMore_w.png"
              alt="Liv More"
              width={200}
              height={200}
              priority
              className="mb-4"
            />
            
            <div className={`text-center ${protoMono.className}`}>
              <h2 className="text-2xl font-bold mb-2">Welcome back!</h2>
              <p className="text-gray-400">Please accept our Terms of Service and Privacy Policy to continue.</p>
            </div>

            <div className="flex flex-col gap-4 w-full max-w-md">
              <div className="flex items-center gap-2 w-full">
                <input
                  type="checkbox"
                  id="termsCheckbox"
                  onChange={(e) => setIsTermsChecked(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor="termsCheckbox" className="text-sm text-gray-300">
                  I agree to the{" "}
                  <a
                    href="https://livmore.life/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300"
                  >
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a
                    href="https://livmore.life/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300"
                  >
                    Privacy Policy
                  </a>
                </label>
              </div>
              <Boton
                onClick={handleUpdateTerms}
                disabled={!isTermsChecked}
                className="w-full border-2 border-gray-800 bg-gray-900 hover:bg-gray-800 flex items-center justify-center gap-2 py-3 rounded"
              > 
                <span className="text-base font-semibold">Continue to Dashboard</span>
              </Boton>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Si el usuario está en whitelist pero no puede usar la app
  if (isWhitelisted && !canUse) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex flex-col">
        <main className="flex-1 flex items-center justify-center p-2">
          <div className="flex flex-col items-center gap-6">
            <Image
              src="/livMore_w.png"
              alt="Liv More"
              width={200}
              height={200}
              priority
              className="mb-4"
            />
            
            <div className={`text-center ${protoMono.className}`}>
              <h2 className="text-2xl font-bold mb-2">Thank you for your interest!</h2>
              <p className="text-gray-400">Your request is being processed. We will notify you when you can access the application.</p>
            </div>
          </div>
        </main>

        <footer className="w-full overflow-hidden py-2 mb-4">
          <div className="relative flex flex-col gap-0.5">
            <p className="text-center text-gray-400 text-sm">
              made with <span className="text-red-500 text-lg">❤</span> during ETH Denver
            </p>
          </div>
        </footer>
      </div>
    );
  }

  // Si el usuario no está en whitelist
  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col">
      <main className="flex-1 flex items-center justify-center p-2">
        <div className="flex flex-col items-center gap-3">
          <div className="flex justify-between items-center w-full max-w-2xl mb-3">
            <div className="flex items-center">
              <Image
                src="/livMore_w.png"
                alt="Liv More"
                width={64}
                height={64}
                priority
              />
            </div>
            {context?.user && context.user.pfpUrl && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-full text-white min-w-[150px] border-2 border-gray-700">
                  <Image
                    src={context.user.pfpUrl}
                    alt="Profile"
                    width={32}
                    height={32}
                    className="rounded-full border-2 border-gray-700"
                    unoptimized
                  />
                  <span className={`text-base font-semibold ${protoMono.className}`}>{context.user.username}</span>
                </div>
              </div>
            )}
          </div>

          <div className="relative border-2 border-gray-800 bg-gray-900 rounded-2xl p-0 max-w-2xl w-full overflow-hidden">
            <div className={`relative z-10 text-center space-y-3 ${protoMono.className}`}>
              <div className="flex flex-col gap-1">
                <h1 className="text-4xl font-bold">Liv More</h1>
              </div>
              <p className="text-lg leading-relaxed mt-3 text-gray-300">Gamifying wellness by integrating wearables, blockchain attestations and social challenges.</p>
              
              <div className="grid grid-cols-3 gap-8 mt-8">
                {/* Calories */}
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-gray-700 flex items-center justify-center">
                      <CaloriesIcon className="w-10 h-10" />
                    </div>
                    <div className="absolute inset-0 rounded-full border-4 border-red-500" style={{ clipPath: 'inset(50% 0 0 0)' }}></div>
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-base font-bold"><span className="text-white">180</span><span className="text-gray-500">/350</span></p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Calories</p>
                  </div>
                </div>

                {/* Steps */}
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-gray-700 flex items-center justify-center">
                      <StepsIcon className="w-10 h-10" />
                    </div>
                    <div className="absolute inset-0 rounded-full border-4 border-red-500" style={{ clipPath: 'inset(13% 0 0 0)' }}></div>
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-base font-bold"><span className="text-white">6.5K</span><span className="text-gray-500">/7.5K</span></p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Steps Taken</p>
                  </div>
                </div>

                {/* Sleep */}
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-gray-700 flex items-center justify-center">
                      <SleepIcon className="w-10 h-10" />
                    </div>
                    <div className="absolute inset-0 rounded-full border-4 border-green-500"></div>
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-base font-bold"><span className="text-white">7.5h</span><span className="text-gray-500">/7h</span></p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Hours Slept</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`flex flex-col items-center gap-3 w-full max-w-2xl ${protoMono.className}`}>
            <div className="flex flex-col gap-4 w-full">
              <div className="flex items-center gap-2 w-full">
                <input
                  type="checkbox"
                  id="termsCheckbox"
                  onChange={(e) => setIsTermsChecked(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor="termsCheckbox" className="text-sm text-gray-300">
                  I agree to the{" "}
                  <a
                    href="https://livmore.life/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300"
                  >
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a
                    href="https://livmore.life/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300"
                  >
                    Privacy Policy
                  </a>
                </label>
              </div>
              <Boton
                onClick={handleEarlyAccess}
                disabled={added || !isTermsChecked}
                className="w-full border-2 border-gray-800 bg-gray-900 hover:bg-gray-800 flex items-center justify-center gap-2 py-3 rounded"
              > 
                <span className="text-base font-semibold">⏰ Join the wait list⏳</span>
              </Boton>
            </div>

            <p className="text-lg text-center leading-relaxed text-white-400">
              You will be notified when we launch!
            </p>
          </div>
        </div>
      </main>

      <footer className="w-full overflow-hidden py-2 mb-2">
        <div className="relative flex flex-col gap-0.5">
          <p className="text-center text-gray-400 text-sm">
            made with <span className="text-red-500 text-lg">❤</span> during ETH Denver
          </p>
        </div>
      </footer>

      {/* Popup Modal */}
      {showPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-gray-900 border-2 border-gray-800 rounded-xl p-8 max-w-md w-full mx-4">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 relative">
                <Image
                  src="/livMore_w.png"
                  alt="Liv More"
                  fill
                  className="object-contain"
                />
              </div>
              <div className={`text-center ${protoMono.className} space-y-4`}>
                <div className="whitespace-pre-line">
                  {whitelistInfo}
                </div>
                {addFrameResult && (
                  <div className="text-green-500 text-sm mt-4">
                    {addFrameResult}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Just Frame It Popup */}
      {showJustFrameItPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-gray-900 border-2 border-gray-700 rounded-xl p-4 max-w-4xl w-full mx-4 relative">
            {/* Botón de cerrar */}
            <button 
              onClick={() => setShowJustFrameItPopup(false)}
              className="absolute -top-4 -right-2 text-gray-400 hover:text-white transition-colors bg-gray-900 rounded-full p-1 border-2 border-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex flex-col items-center gap-6">
              <div className="w-full h-64 relative">
                <Image
                  src="/frameIt.png"
                  alt="Just Frame It"
                  fill
                  className="object-contain rounded-lg"
                />
              </div>
              
              <div className={`text-center ${protoMono.className} space-y-4`}>
                <p className="text-gray-300 leading-relaxed text-sm">
                  We have been selected to participate in the Just Frame It program, a two-month builder program designed to empower developers, product creators, and founders to build Frames on Farcaster.
                </p>
              </div>

              <Boton
                onClick={handleShare}
                className="mt-4 border-2 border-gray-800 bg-gray-900 hover:bg-gray-800 flex items-center justify-center gap-2 py-3 px-6 rounded"
              >
                <span className={`text-base font-semibold ${protoMono.className}`}>Share Frame</span>
              </Boton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}