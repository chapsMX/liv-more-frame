"use client";

import { useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { protoMono } from '../styles/fonts';
import { ROOK_CONFIG } from '@/constants/rook';
import type { UserState } from '@/context/UserContext';

export default function RookDeviceConnection() {
  const { userState, setUserState } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

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
      const provider = searchParams.get('provider');
      const rookUserId = searchParams.get('userId');
      const status = searchParams.get('status');
      const fromRedirect = searchParams.get('from_redirect');
      const clientUuid = searchParams.get('client_uuid');
      const userId = searchParams.get('user_id');

      // Si venimos de una redirección de Rook, usar esos parámetros
      if (fromRedirect === 'true' && clientUuid && userId) {
        console.log('🔍 Procesando redirección de Rook:', { clientUuid, userId });
        
        try {
          // Verificar la conexión en nuestra API
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
    <div className="min-h-screen bg-black text-white font-mono">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Header */}
        <div className="flex justify-between items-center w-full max-w-2xl mb-8">
          <div className="flex items-center">
            <Image
              src="/livMore_w.png"
              alt="Liv More"
              width={60}
              height={60}
              priority
            />
          </div>
        </div>

        {/* Título y descripción */}
        <div className="mb-8 text-center">
          <h1 className={`text-xl font-bold mb-4 ${protoMono.className}`}>
            Connect your wearable.
          </h1>
          <p className={`text-gray-400 max-w-2xl mx-auto mb-8 ${protoMono.className}`}>
            Supported devices: Fitbit, Garmin, Oura, Whoop & Polar.
          </p>
          
          {/* Botón para abrir Rook Connections en una nueva ventana */}
          <button
            onClick={openRookConnections}
            disabled={!userState.userFid}
            className="mx-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            Connect your wearable
          </button>
        </div>
      </div>
    </div>
  );
} 