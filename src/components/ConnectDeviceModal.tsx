"use client";

import { protoMono } from '../styles/fonts';
import { useState } from 'react';

interface ConnectDeviceModalProps {
  onClose: () => void;
  onConnect: (provider: string) => void;
  userFid: string;
}

export default function ConnectDeviceModal({ onClose, onConnect, userFid }: ConnectDeviceModalProps) {
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isConnectingGarmin, setIsConnectingGarmin] = useState(false);

  const handleGoogleConnect = async () => {
    try {
      setIsConnectingGoogle(true);
      console.log('Iniciando conexión con Google...');
      
      const response = await fetch(`/auth/google/connect?user_fid=${userFid}`);
      console.log('Respuesta de Google:', response.status);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Error response:', errorData);
        throw new Error(`Error al obtener la URL de autorización: ${errorData}`);
      }
      
      const { url } = await response.json();
      
      // 2. Abrir la ventana de autorización
      const authWindow = window.open(url, 'Google Auth', 'width=600,height=600');
      if (!authWindow) {
        throw new Error('No se pudo abrir la ventana de autorización');
      }

      // 3. Escuchar mensajes de la ventana de autorización
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data === 'refresh') {
          // Limpiar el listener
          window.removeEventListener('message', handleMessage);
          // Notificar éxito
          onConnect('google');
          // Cerrar el modal
          onClose();
          // Recargar la aplicación
          window.location.reload();
          return;
        }
      };

      window.addEventListener('message', handleMessage);
    } catch (error) {
      console.error('Error al conectar con Google:', error);
      alert(error instanceof Error ? error.message : 'Error al conectar con Google Fit');
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleGarminConnect = async () => {
    try {
      setIsConnectingGarmin(true);
      console.log('Iniciando conexión con Garmin...');
      
      const response = await fetch(`/auth/garmin/connect?user_fid=${userFid}`);
      console.log('Respuesta de Garmin:', response.status);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Error response:', errorData);
        throw new Error(`Error al obtener la URL de autorización: ${errorData}`);
      }
      
      const { url } = await response.json();
      
      // 2. Abrir la ventana de autorización
      const authWindow = window.open(url, 'Garmin Auth', 'width=600,height=600');
      if (!authWindow) {
        throw new Error('No se pudo abrir la ventana de autorización');
      }

      // 3. Escuchar mensajes de la ventana de autorización
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data === 'refresh') {
          // Limpiar el listener
          window.removeEventListener('message', handleMessage);
          // Notificar éxito
          onConnect('garmin');
          // Cerrar el modal
          onClose();
          // Recargar la aplicación
          window.location.reload();
          return;
        }
      };

      window.addEventListener('message', handleMessage);
    } catch (error) {
      console.error('Error al conectar con Garmin:', error);
      alert(error instanceof Error ? error.message : 'Error al conectar con Garmin');
    } finally {
      setIsConnectingGarmin(false);
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
          <p className={`text-gray-300 text-center ${protoMono.className}`}>
            Select your activity data provider to continue
          </p>

          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={handleGoogleConnect}
              disabled={isConnectingGoogle || isConnectingGarmin}
              className={`p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-center border-2 border-orange-500 ${protoMono.className} ${isConnectingGoogle ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="text-white">
                {isConnectingGoogle ? 'Connecting...' : 'Fitness Google'}
              </span>
            </button>
            <button
              onClick={handleGarminConnect}
              disabled={isConnectingGarmin || isConnectingGoogle}
              className={`p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-center border-2 border-orange-500 ${protoMono.className} ${isConnectingGarmin ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="text-white">
                {isConnectingGarmin ? 'Connecting...' : 'Garmin Connect'}
              </span>
            </button>
            <button
              disabled
              className={`p-4 bg-gray-800 opacity-50 cursor-not-allowed rounded-xl text-center border-2 border-gray-700 ${protoMono.className}`}
            >
              <span className="text-gray-500">Oura Ring (Coming Soon)</span>
            </button>
            <button
              disabled
              className={`p-4 bg-gray-800 opacity-50 cursor-not-allowed rounded-xl text-center border-2 border-gray-700 ${protoMono.className}`}
            >
              <span className="text-gray-500">Whoop (Coming Soon)</span>
            </button>
          </div>

          <p className={`text-gray-400 text-sm text-center ${protoMono.className}`}>
            * We only collect basic activity data and do not access any sensitive information about your health habits.
          </p>
        </div>
      </div>
    </div>
  );
} 