"use client";

import { useEffect, useState } from 'react';
import { useUser } from '../context/UserContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { protoMono } from '../styles/fonts';
import { ROOK_CONFIG } from '@/constants/rook';
import { sdk } from "@farcaster/miniapp-sdk";

export default function RookDeviceConnection() {
  const { userState, setUserState } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pfpUrl, setPfpUrl] = useState<string>();

  useEffect(() => {
    // Verificar si el usuario ya tiene un provider conectado
    if (userState.connectedProvider) {
      console.log('🔄 Usuario ya tiene provider conectado:', userState.connectedProvider);
      router.push('/dashboard');
      return;
    }

    // Verificar si la URL contiene parámetros de retorno de Rook
    const handleRookCallback = async () => {
      if (typeof window === 'undefined') return;
      
      // Extraer parámetros de la URL
      const provider = searchParams?.get('provider');
      const rookUserId = searchParams?.get('userId');
      const status = searchParams?.get('status');
      const fromRedirect = searchParams?.get('from_redirect');
      const clientUuid = searchParams?.get('client_uuid');
      const userId = searchParams?.get('user_id');

      console.log('📝 Parámetros de URL:', {
        provider,
        rookUserId,
        status,
        fromRedirect,
        clientUuid,
        userId,
        currentUserFid: userState.userFid
      });

      // Si venimos de una redirección de Rook, usar esos parámetros
      if (fromRedirect === 'true' && clientUuid && userId) {
        console.log('🔍 Procesando redirección de Rook:', { clientUuid, userId });
        
        try {
          // Verificar la conexión en nuestra API
          console.log('🔍 Verificando conexión en API:', `/api/users/check-rook-connections?fid=${userId}`);
          const response = await fetch(`/api/users/check-rook-connections?fid=${userId}`);
          const data = await response.json();
          
          if (response.ok && data.provider) {
            console.log('✅ Conexión encontrada:', data);
            
            // Actualizar el estado del usuario
            setUserState({
              connectedProvider: data.provider
            });
            
            router.push('/dashboard');
          }
        } catch (error) {
          console.error('❌ Error verificando conexión:', error);
        }
        return;
      }
      
      // Si tenemos parámetros directos de la API de Rook
      if (provider && rookUserId && status === 'success' && userState.userFid) {
        console.log('✅ Conexión exitosa con Rook:', { 
          provider,
          rook_user_id: rookUserId,
          user_fid: userState.userFid 
        });
        
        try {
          // Guardar la conexión en la base de datos
          const response = await fetch('/api/users/save-rook-connection', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_fid: userState.userFid,
              provider,
              rook_user_id: rookUserId,
            }),
          });

          if (response.ok) {
            console.log('✅ Conexión guardada en base de datos');
            // Actualizar el estado del usuario con el nuevo provider
            setUserState({
              connectedProvider: provider
            });
            router.push('/dashboard');
          } else {
            console.error('❌ Error guardando la conexión:', await response.text());
          }
        } catch (error) {
          console.error('❌ Error en el proceso de conexión:', error);
        }
      }
    };

    handleRookCallback();
  }, [userState, router, setUserState, searchParams]);

  useEffect(() => {
    const loadUserProfile = async () => {
      const context = await sdk.context;
      if (context.user?.pfpUrl) {
        setPfpUrl(context.user.pfpUrl);
      }
    };

    loadUserProfile();
  }, []);

  // Importante: Usamos el user_fid como identificador en la URL de Rook
  const encodedRedirectUrl = encodeURIComponent(ROOK_CONFIG.getRedirectUrl());
  const rookConnectionsUrl = `${ROOK_CONFIG.CONNECTIONS_URL}/client_uuid/${ROOK_CONFIG.CLIENT_UUID}/user_id/${userState.userFid}?redirect_url=${encodedRedirectUrl}`;
  
  const openRookConnections = () => {
    if (!userState.userFid) {
      console.error('❌ Error: No se encontró el user_fid');
      return;
    }
    
    console.log('🔗 Abriendo URL de conexión Rook:', rookConnectionsUrl);
    window.open(rookConnectionsUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={`min-h-screen bg-black text-white ${protoMono.className}`}>
      <div className="container mx-auto px-4 py-2">
        <div className="flex justify-between items-center w-full max-w-2xl mx-auto mb-2">
          <div className="flex items-center">
            <Image
              src="/livMore_w.png"
              alt="Liv More"
              width={60}
              height={60}
              priority
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2 py-1 bg-gray-800 rounded-full text-white min-w-[150px] border-2 border-gray-700">
              {pfpUrl && (
                <Image
                  src={pfpUrl}
                  alt="Profile"
                  width={32}
                  height={32}
                  className="rounded-full border-2 border-gray-700"
                  unoptimized
                />
              )}
              <span className={`text-base font-semibold ${protoMono.className}`}>
                {userState.username}
              </span>
              <button
                onClick={() => router.push('/dashboard')}
                className="ml-2 text-gray-400 hover:text-white transition-colors"
                aria-label="Back"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 19l-7-7 7-7" />
                  <path d="M3 12h18" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col items-center justify-center space-y-6 p-2">
          <h1 className={`text-2xl font-bold text-white mb-2 ${protoMono.className}`}>
            Connect your wearable.
          </h1>
          
          <div className="w-full max-w-4xl bg-gray-900 border-2 border-gray-700 rounded-xl p-6">
            <div className="text-center">
              <p className={`text-gray-400 max-w-2xl mx-auto mb-8 ${protoMono.className}`}>
                Supported devices: Fitbit, Garmin, Oura, Whoop & Polar.
              </p>
              
              {/* Botón para abrir Rook Connections en una nueva ventana */}
              <button
                onClick={openRookConnections}
                disabled={!userState.userFid}
                className={`mx-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed ${protoMono.className}`}
              >
                Connect your wearable
              </button>
              
              {!userState.userFid && (
                <p className="text-red-500 text-sm mt-4">
                  Error: User FID not available
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 