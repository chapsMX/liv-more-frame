"use client";

import { protoMono } from '../styles/fonts';
import { useState } from 'react';

interface ConnectDeviceModalProps {
  onClose: () => void;
  onConnect: (provider: string) => void;
  userFid: string;
}

export default function ConnectDeviceModal({ onClose, onConnect, userFid }: ConnectDeviceModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleGoogleConnect = async () => {
    try {
      setIsConnecting(true);
      
      // 1. Obtener la URL de autorización
      const response = await fetch(`/auth/connect?user_fid=${userFid}`);
      if (!response.ok) {
        throw new Error('Error al obtener la URL de autorización');
      }
      
      const { url } = await response.json();
      
      // 2. Abrir la ventana de autorización
      const authWindow = window.open(url, 'Google Auth', 'width=600,height=600');
      if (!authWindow) {
        throw new Error('No se pudo abrir la ventana de autorización');
      }

      // 3. Escuchar mensajes de la ventana de autorización
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data.type === 'GOOGLE_AUTH_CODE') {
          try {
            // 4. Enviar el código al endpoint de callback
            const callbackResponse = await fetch('/auth/callback', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-fid': userFid
              },
              body: JSON.stringify({ code: event.data.code })
            });

            if (!callbackResponse.ok) {
              const error = await callbackResponse.json();
              throw new Error(error.error || 'Error al procesar la autorización');
            }

            const result = await callbackResponse.json();
            if (result.success) {
              onConnect('google');
              onClose();
            } else {
              throw new Error(result.error || 'Error al conectar con Google Fit');
            }
          } catch (error) {
            console.error('Error en el callback:', error);
            alert(error instanceof Error ? error.message : 'Error al conectar con Google Fit');
          } finally {
            window.removeEventListener('message', handleMessage);
            setIsConnecting(false);
          }
        }
      };

      window.addEventListener('message', handleMessage);
    } catch (error) {
      console.error('Error al conectar con Google:', error);
      alert(error instanceof Error ? error.message : 'Error al conectar con Google Fit');
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-[#1C1F2A] p-8 rounded-3xl w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className={`text-xl font-bold text-white text-center w-full ${protoMono.className}`}>Connect your wearable!</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors absolute right-4 top-4"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-8">
          <p className={`text-gray-300 ${protoMono.className}`}>
            Now you need to connect your wearable device. This is how we will track your physical activities.
          </p>

          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={handleGoogleConnect}
              disabled={isConnecting}
              className={`p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-center border-2 border-orange-500 ${protoMono.className} ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="text-white">
                {isConnecting ? 'Connecting...' : 'Google Fit'}
              </span>
            </button>
            <button
              disabled
              className={`p-4 bg-gray-800 opacity-50 cursor-not-allowed rounded-xl text-center border-2 border-gray-700 ${protoMono.className}`}
            >
              <span className="text-gray-500">Oura (Coming Soon)</span>
            </button>
            <button
              disabled
              className={`p-4 bg-gray-800 opacity-50 cursor-not-allowed rounded-xl text-center border-2 border-gray-700 ${protoMono.className}`}
            >
              <span className="text-gray-500">Whoop (Coming Soon)</span>
            </button>
            <button
              disabled
              className={`p-4 bg-gray-800 opacity-50 cursor-not-allowed rounded-xl text-center border-2 border-gray-700 ${protoMono.className}`}
            >
              <span className="text-gray-500">Garmin (Coming Soon)</span>
            </button>
          </div>

          <p className={`text-gray-400 text-sm ${protoMono.className}`}>
            * We only collect basic activity data and do not access any sensitive information about your health habits.
          </p>
        </div>
      </div>
    </div>
  );
} 