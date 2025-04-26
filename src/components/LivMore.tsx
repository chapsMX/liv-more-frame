"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import sdk, {
AddFrame,
  type Context
} from "@farcaster/frame-sdk";
import Image from 'next/image';
import { protoMono } from '../styles/fonts';
import { Boton } from "../styles/ui/boton";
import Loader from './Loader';
import GoalsModal from './GoalsModal';
import ConnectDeviceModal from './ConnectDeviceModal';
import { CaloriesIcon, StepsIcon, SleepIcon } from '../styles/svg/index';
import Footer from './Footer';

interface UserState {
  is_whitelisted: boolean;
  can_use: boolean;
  accepted_tos: boolean;
  accepted_privacy_policy: boolean;
  hasGoals?: boolean;
  provider?: string | null;
}

export default function LivMore() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [context, setContext] = useState<Context.FrameContext>();
  const [userState, setUserState] = useState<UserState | null>(null);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [isTermsChecked, setIsTermsChecked] = useState(false);

  // Cargar el contexto de Farcaster y verificar el estado del usuario
  useEffect(() => {
    const load = async () => {
      try {
        console.log("Iniciando carga del SDK");
        const context = await sdk.context;
        setContext(context);
        
        if (context.user?.fid) {
          await checkUserState(context.user.fid.toString());
          
          // Intentar agregar el frame automáticamente
          try {
            await sdk.actions.addFrame();
          } catch (error) {
            if (error instanceof AddFrame.RejectedByUser) {
              console.log('Usuario rechazó agregar el frame');
            }
          }
        }

        // Indicar que la app está lista para ser mostrada
        await sdk.actions.ready();
      } catch (error) {
        console.error('Error loading context:', error);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  // Verificar el estado completo del usuario
  const checkUserState = async (fid: string) => {
    try {
      console.log('Checking user state for FID:', fid);
      
      // 1. Verificar whitelist y términos
      const whitelistResponse = await fetch(`/api/whitelist/check?user_fid=${fid}`);
      if (!whitelistResponse.ok) {
        throw new Error('Error fetching whitelist status');
      }
      const whitelistData = await whitelistResponse.json();
      console.log('Raw whitelist data:', whitelistData);
      
      // 2. Si puede usar la app, verificar goals
      let hasGoals = false;
      let provider = null;
      
      if (whitelistData.is_whitelisted && 
          whitelistData.can_use && 
          whitelistData.accepted_tos && 
          whitelistData.accepted_privacy_policy) {
        console.log('User can use app, checking goals and provider...');
        
        // Verificar goals
        const goalsResponse = await fetch(`/api/goals/check?user_fid=${fid}`);
        const goalsData = await goalsResponse.json();
        hasGoals = goalsData.hasGoals;
        console.log('Goals data:', goalsData);

        // Verificar proveedor conectado
        const providerResponse = await fetch(`/api/auth/check-provider?user_fid=${fid}`);
        const providerData = await providerResponse.json();
        provider = providerData.provider;
        console.log('Provider data:', providerData);
      }

      const newUserState = {
        is_whitelisted: whitelistData.is_whitelisted || false,
        can_use: whitelistData.can_use || false,
        accepted_tos: whitelistData.accepted_tos || false,
        accepted_privacy_policy: whitelistData.accepted_privacy_policy || false,
        hasGoals,
        provider
      };
      
      console.log('Setting new user state:', newUserState);
      setUserState(newUserState);

      // Redirigir al dashboard si el usuario está completamente configurado
      if (newUserState.is_whitelisted && 
          newUserState.can_use && 
          newUserState.accepted_tos && 
          newUserState.accepted_privacy_policy) {
        console.log('User has basic requirements met');
        
        if (!hasGoals) {
          console.log('User needs to set goals');
          setShowGoalsModal(true);
          return;
        }
        
        if (!provider) {
          console.log('User needs to connect a device');
          setShowConnectModal(true);
        return;
      }

        console.log('All requirements met, redirecting to dashboard...', { provider });
        router.push(`/dashboard/${provider}`);
      } else {
        console.log('User does not meet basic requirements:', {
          is_whitelisted: newUserState.is_whitelisted,
          can_use: newUserState.can_use,
          accepted_tos: newUserState.accepted_tos,
          accepted_privacy_policy: newUserState.accepted_privacy_policy
        });
      }

    } catch (error) {
      console.error('Error checking user state:', error);
    }
  };

  // Función para generar un nonce válido
  const generateNonce = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const length = 32; // Longitud suficiente para seguridad
    let nonce = '';
    for (let i = 0; i < length; i++) {
      nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
  };

  // Manejar la adición a la whitelist
  const handleJoinWaitlist = async () => {
    try {
      if (!context?.user?.fid) return;

      // 1. Autenticar al usuario con SIWF usando un nonce válido
      const nonce = generateNonce();
      console.log('Nonce generado:', nonce); // Para debugging
      
      const signInResult = await sdk.actions.signIn({ nonce });
      
      if (!signInResult) {
        throw new Error('Error en la autenticación');
      }

      // 2. Obtener datos del usuario de Neynar
      const neynarResponse = await fetch(`/api/neynar?fid=${context.user.fid}`);
      const neynarData = await neynarResponse.json();

      if (!neynarData.success) throw new Error(neynarData.error);

      // 3. Agregar a la whitelist con la firma SIWF
      const whitelistResponse = await fetch('/api/whitelist/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_fid: context.user.fid,
          username: neynarData.user.username,
          eth_address: neynarData.user.custody_address,
          display_name: neynarData.user.display_name,
          accepted_tos: true,
          accepted_privacy_policy: true,
          siwf_message: signInResult.message,
          siwf_signature: signInResult.signature
        }),
      });

      const whitelistData = await whitelistResponse.json();
      if (!whitelistData.success) throw new Error(whitelistData.error);

      // 4. Compartir usando openUrl para abrir Warpcast
      const text = encodeURIComponent("¡Me he unido a la lista de espera de @livmore! 🧬\nGamificando el bienestar con wearables y blockchain.");
      const url = encodeURIComponent("https://app.livmore.life");
      await sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${text}&embeds[]=${url}`);

      // 5. Actualizar el estado del usuario
      await checkUserState(context.user.fid.toString());

    } catch (error) {
      console.error('Error joining waitlist:', error);
    }
  };

  // Manejar el guardado de goals
  const handleSaveGoals = async (goals: { calories: number; steps: number; sleep: number }) => {
    try {
      if (!context?.user?.fid) return;

      const response = await fetch('/api/goals/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_fid: context.user.fid,
          ...goals
        }),
        });

      const data = await response.json();
      if (data.success) {
        setShowGoalsModal(false);
        await checkUserState(context.user.fid.toString());
    }
    } catch (error) {
      console.error('Error saving goals:', error);
    }
  };

  // Manejar la conexión del dispositivo
  const handleConnectDevice = async (provider: string) => {
    try {
      setShowConnectModal(false);
      await checkUserState(context!.user!.fid.toString());
    } catch (error) {
      console.error('Error connecting device:', error);
    }
  };

  if (isLoading) {
    return <Loader message="Loading..." />;
  }

  // Usuario no está logueado o no tiene FID
  if (!context?.user?.fid) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className={`text-2xl font-bold mb-4 ${protoMono.className}`}>Welcome to LivMore</h1>
            <p className={`text-gray-400 ${protoMono.className}`}>Please connect with your Farcaster account to continue.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Usuario en whitelist pero no puede usar la app
  if (userState?.is_whitelisted && !userState.can_use) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex flex-col">
        <main className="flex-grow container mx-auto px-2 py-2">
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
        <Footer />
      </div>
    );
  }

  // Usuario puede usar la app pero necesita configuración
  if (userState?.can_use) {
    // Necesita aceptar términos
    if (!userState.accepted_tos || !userState.accepted_privacy_policy) {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col">
          <div className="flex-grow flex items-center justify-center">
            <div className="text-center max-w-md mx-auto p-6">
              <h1 className={`text-2xl font-bold mb-4 ${protoMono.className}`}>Welcome to LivMore!</h1>
              <p className={`text-gray-400 mb-6 ${protoMono.className}`}>Please accept our terms to continue.</p>
              
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="termsCheckbox"
                    onChange={(e) => setIsTermsChecked(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="termsCheckbox" className="text-sm text-gray-300">
                    I agree to the{" "}
                    <a href="/terms" target="_blank" className="text-blue-400 hover:text-blue-300">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="/privacy" target="_blank" className="text-blue-400 hover:text-blue-300">
                      Privacy Policy
                    </a>
                  </label>
                </div>
                
                <Boton
                  onClick={handleJoinWaitlist}
                  disabled={!isTermsChecked}
                  className="w-full py-3 bg-violet-600 hover:bg-violet-700 rounded-xl"
                >
                  Continue
                </Boton>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Necesita configurar goals
    if (!userState.hasGoals) {
      return <GoalsModal onSave={handleSaveGoals} />;
  }

    // Necesita conectar dispositivo
    if (!userState.provider) {
      return (
        <ConnectDeviceModal
          onClose={() => {}} // No permitimos cerrar si no hay proveedor
          onConnect={handleConnectDevice}
          userFid={context.user.fid.toString()}
        />
      );
    }
  }

  // Usuario nuevo - Mostrar landing con opción de unirse a la waitlist
  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col">
      <main className="flex-grow container mx-auto px-2 py-2">
          <div className="flex flex-col items-center gap-6">
            <Image
              src="/livMore_w.png"
              alt="Liv More"
            width={100}
            height={100}
              priority
            className="mb-2"
            />
            
          <div className={`text-center max-w-2xl ${protoMono.className}`}>
            <h1 className="text-4xl font-bold mb-4">Liv More</h1>
            <p className="text-xl text-gray-300 mb-4">
              Gamifying wellness by integrating wearables, blockchain attestations and social challenges.
            </p>
                
            {/* Métricas simuladas */}
            <div className="grid grid-cols-3 gap-8 max-w-xl mx-auto mb-4">
                  {/* Calories */}
                  <div className="flex flex-col items-center">
                    <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-gray-700 flex items-center justify-center bg-gray-900">
                    <CaloriesIcon className="w-10 h-10 text-white" />
                      </div>
                  <div className="absolute inset-0 rounded-full border-4 border-violet-500" style={{ clipPath: 'inset(50% 0 0 0)' }}></div>
                    </div>
                    <div className="mt-4 text-center">
                      <p className="text-base font-bold"><span className="text-white">180</span><span className="text-gray-500">/350</span></p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Calories</p>
                    </div>
                  </div>

                  {/* Steps */}
                  <div className="flex flex-col items-center">
                    <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-gray-700 flex items-center justify-center bg-gray-900">
                    <StepsIcon className="w-10 h-10 text-white" />
                      </div>
                  <div className="absolute inset-0 rounded-full border-4 border-violet-500" style={{ clipPath: 'inset(13% 0 0 0)' }}></div>
                    </div>
                    <div className="mt-4 text-center">
                      <p className="text-base font-bold"><span className="text-white">6.5K</span><span className="text-gray-500">/7.5K</span></p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Steps</p>
                    </div>
                  </div>

                  {/* Sleep */}
                  <div className="flex flex-col items-center">
                    <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-gray-700 flex items-center justify-center bg-gray-900">
                    <SleepIcon className="w-10 h-10 text-white" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-4 border-violet-500" style={{ clipPath: 'inset(75% 0 0 0)' }}></div>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-base font-bold"><span className="text-white">5.5h</span><span className="text-gray-500">/7h</span></p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Sleep</p>
                </div>
              </div>
            </div>
          </div>


            <div className={`flex flex-col gap-4 w-full max-w-md ${protoMono.className}`}>         
            <Boton
              onClick={handleJoinWaitlist}
              disabled={!isTermsChecked}
              className="w-full p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-center border-2 border-violet-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-800"
            >
              <span className="text-white font-medium">
                ⚡️ Join Waitlist ⚡️
              </span>
            </Boton>

            <div className="flex items-center justify-center text-center">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="termsCheckbox"
                  onChange={(e) => setIsTermsChecked(e.target.checked)}
                  className="w-4 h-4 text-violet-600 bg-gray-900 border-gray-700 rounded focus:ring-violet-500"
                />
                <label htmlFor="termsCheckbox" className="text-xs text-gray-300">
                  I agree to the{" "}
                  <a href="/terms" target="_blank" className="text-violet-400 hover:text-violet-300 underline">
                    Terms of Service
                  </a>{" "}
                  &{" "}
                  <a href="/privacy" target="_blank" className="text-violet-400 hover:text-violet-300 underline">
                    Privacy Policy
                  </a>
                </label>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}