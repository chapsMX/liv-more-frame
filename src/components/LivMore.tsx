"use client";

import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useRouter } from 'next/navigation';

interface SDKContext {
  user?: {
    fid: number;
    username?: string;
    pfpUrl?: string;
  };
  client: {
    added: boolean;
  };
}

import { Boton } from "../styles/ui/boton";
import { protoMono } from '../styles/fonts';
import Image from 'next/image';
import { CaloriesIcon, StepsIcon, SleepIcon } from '../styles/svg/index';
import '../styles/footer.css';
import { useUser } from '../context/UserContext';
import { TOSModal } from './TOSModal';

export default function LivMore() {
  const router = useRouter();
  const { userState, setUserState } = useUser();
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<SDKContext>();
  const [added, setAdded] = useState(false);
  const [addFrameResult, setAddFrameResult] = useState("");
  const [whitelistInfo, setWhitelistInfo] = useState("");
  const [isUserInDatabase, setIsUserInDatabase] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showPopup, setShowPopup] = useState(false);
  const [countdown, setCountdown] = useState(10);

  const checkUserInDatabase = async (fid: number, userContext?: SDKContext) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/whitelist/check?fid=${fid}`);
      const data = await response.json();
      
      // Si el usuario existe en la base de datos (independientemente de whitelist)
      const userExists = data.isWhitelisted || data.acceptedTos || data.acceptedPrivacyPolicy;
      
      if (userExists) {
        setUserState({
          isWhitelisted: true, // Ahora todos los usuarios pueden usar la app
          acceptedTos: data.acceptedTos,
          acceptedPrivacyPolicy: data.acceptedPrivacyPolicy,
          canUse: true, // Todos pueden usar la app
          username: data.username,
          displayName: data.displayName,
          userFid: fid,
          ethAddress: data.ethAddress
        });
        setIsUserInDatabase(true);
      } else {
        // Usuario nuevo - no está en la base de datos
        const contextToUse = userContext || context;
        setUserState({
          isWhitelisted: true, // Todos pueden usar la app ahora
          acceptedTos: false,
          acceptedPrivacyPolicy: false,
          canUse: true,
          username: contextToUse?.user?.username || '',
          displayName: '',
          userFid: fid,
          ethAddress: ''
        });
        setIsUserInDatabase(false);
      }
    } catch (error) {
      console.error('Error checking user status:', error);
      // En caso de error, asumir que es usuario nuevo
      setIsUserInDatabase(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetStarted = async () => {
    try {
      // Primero obtenemos la info del usuario
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
      const registerResponse = await fetch('/api/whitelist/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_fid: context.user.fid,
          username,
          eth_address: custody_address,
          display_name
        }),
      });

      const registerData = await registerResponse.json();

      if (registerData.success) {
        // Actualizar el estado del usuario después de agregarlo exitosamente
        await checkUserInDatabase(context.user.fid, context);
        
        setWhitelistInfo(
          `✨ Welcome to Liv More, ${username}!\n` +
          `🎉 Your account has been created successfully.\n` +
          `⏳ Redirecting to dashboard in ${countdown}s...`
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
        try {
          const result = await sdk.actions.addFrame();
          if (result.notificationDetails) {
            setAddFrameResult(
              `✅ Frame added successfully\n` +
              `🔔 Token: ${result.notificationDetails.token}\n` +
              `🔗 URL: ${result.notificationDetails.url}`
            );
          }
        } catch (addFrameError) {
          setAddFrameResult(`❌ Frame not added: ${addFrameError}`);
        }
      } else {
        setWhitelistInfo(`Error creating account: ${registerData.error}`);
      }
    } catch (error) {
      setWhitelistInfo(`Error: ${error}`);
    }
  };

  // contexto del frame
  useEffect(() => {
    const load = async () => {
      try {
        const context = await sdk.context;
        setContext(context);
        setAdded(context.client.added);

        // Verificar whitelist si tenemos el FID
        if (context.user?.fid) {
          await checkUserInDatabase(context.user.fid, context);
        }

        console.log("Calling ready");
        await sdk.actions.ready();
      } catch (error) {
        console.error("Error loading SDK context:", error);
      }
    };

    if (sdk && !isSDKLoaded) {
      console.log("Calling load");
      setIsSDKLoaded(true);
      load();
    }
  }, [isSDKLoaded]);

  useEffect(() => {
    // Redirigir al dashboard si el usuario existe en DB y ha aceptado términos
    console.log('🔍 Verificando estado del usuario:', {
      isUserInDatabase,
      acceptedTos: userState.acceptedTos,
      acceptedPrivacyPolicy: userState.acceptedPrivacyPolicy,
      username: userState.username
    });

    if (isUserInDatabase && userState.acceptedTos && userState.acceptedPrivacyPolicy) {
      console.log('✅ Usuario existente con términos aceptados, redirigiendo a dashboard...');
      router.push('/dashboard');
    } else if (isUserInDatabase && (!userState.acceptedTos || !userState.acceptedPrivacyPolicy)) {
      console.log('ℹ️ Usuario existente sin términos aceptados, mostrando modal TOS...');
    } else if (!isUserInDatabase && !isLoading) {
      console.log('ℹ️ Usuario nuevo, mostrando interfaz de registro...');
    }
  }, [isUserInDatabase, userState.acceptedTos, userState.acceptedPrivacyPolicy, isLoading, router]);

  const shouldShowTOSModal = isUserInDatabase && (!userState.acceptedTos || !userState.acceptedPrivacyPolicy);

  if (shouldShowTOSModal) {
    return <TOSModal username={context?.user?.username} />;
  }

  if (!isSDKLoaded || isLoading) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin"></div>
          <p className={protoMono.className}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col">
      <main className="flex-1 flex items-center justify-center p-2">
        {isUserInDatabase ? (
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
              <p className="text-gray-400">Loading your dashboard...</p>
            </div>
          </div>
        ) : (
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

            <div className="relative border-2 border-gray-800 bg-gray-900 rounded-2xl p-6 max-w-2xl w-full overflow-hidden">
              <div className={`relative z-10 text-center space-y-3 ${protoMono.className}`}>
                <div className="flex flex-col gap-1">
                  <h1 className="text-4xl font-bold">Liv More</h1>
                </div>
                {/* <p className="text-lg leading-relaxed mt-3 text-gray-300"> Maintaining a healthy lifestyle is tough. Even with fitness trackers and health data, people struggle with motivation, consistency, and accountability.</p> */}
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
              <div className="relative">
                <p className="text-sm text-center leading-relaxed mt-1 text-white-400">
                  Join Liv More to start tracking your wellness journey!
                </p>
              </div>
              
              <div className="flex gap-4 w-full">
                <Boton
                  onClick={handleGetStarted}
                  disabled={added}
                  className="w-full border-2 border-gray-800 bg-gray-900 hover:bg-gray-800 flex items-center justify-center gap-2 py-3 rounded"
                > 
                  <span className="text-base font-semibold">Get Started</span>
                </Boton>
              </div>

              <div className="w-full mt-1">
                <div className="mb-4">
                  {(addFrameResult || whitelistInfo) && (
                    <div className="mb-2 text-xs text-left opacity-50 whitespace-pre-line">
                      {whitelistInfo && whitelistInfo}
                      {addFrameResult && `\n${addFrameResult}`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="w-full overflow-hidden py-2 mb-4">
        <div className="relative flex flex-col gap-0.5">
          <p className="text-center text-gray-400 text-sm">
            built with <span className="text-red-500 text-lg">❤</span> during ETH Denver
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



    </div>
  );
}