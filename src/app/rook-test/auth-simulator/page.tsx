'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { protoMono } from '@/styles/fonts';

/**
 * Esta página simula el proceso de autorización de un proveedor de Rook.
 * En un entorno real, el usuario sería redirigido a la página de autorización del proveedor.
 * Aquí simulamos ese flujo para propósitos de prueba.
 */
export default function AuthSimulator() {
  const searchParams = useSearchParams();
  const provider = searchParams.get('provider');
  const userFid = searchParams.get('user_fid');
  const mock = searchParams.get('mock');
  
  const [isAuthorizing, setIsAuthorizing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  
  // Simular el flujo de autorización
  useEffect(() => {
    if (!provider || !userFid) {
      setError('Parámetros de autorización incompletos');
      setIsAuthorizing(false);
      return;
    }
    
    // Simular un proceso de autorización que toma tiempo
    const authTimer = setTimeout(() => {
      console.log(`[Auth Simulator] Autorización simulada completada para ${provider}`);
      
      // En una implementación real, aquí se llamaría a nuestro backend para completar el proceso
      handleAuthorizationComplete();
      
      setIsAuthorizing(false);
      setAuthorized(true);
    }, 3000);
    
    return () => clearTimeout(authTimer);
  }, [provider, userFid]);
  
  /**
   * Simula la finalización del flujo de autorización
   */
  const handleAuthorizationComplete = async () => {
    try {
      // En una implementación real, aquí llamaríamos a nuestra API para procesar el código de autorización
      console.log(`[Auth Simulator] Completando proceso de autorización para ${provider}`);
      
      // Simulamos una llamada a nuestra API
      // await fetch(`/api/rook/auth/callback`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     user_fid: userFid,
      //     provider: provider,
      //     code: 'mock_auth_code_123', // En un flujo real, esto vendría del proveedor
      //   }),
      // });
      
      // Simulamos que la llamada fue exitosa
      
      // En un flujo real, el proveedor cerraría la ventana o redirigiría al usuario
      // Simulamos notificar a la ventana principal de que el proceso se completó
      if (window.opener) {
        window.opener.postMessage('refresh', '*');
        
        // Cerramos automáticamente la ventana después de un tiempo
        setTimeout(() => {
          window.close();
        }, 3000);
      }
      
    } catch (err) {
      console.error('[Auth Simulator] Error al completar autorización:', err);
      setError('Error al completar el proceso de autorización');
    }
  };
  
  // Función para cerrar la ventana manualmente
  const handleClose = () => {
    if (window.opener) {
      window.opener.postMessage('refresh', '*');
    }
    window.close();
  };
  
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="p-4 bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto">
          <h1 className={`text-2xl font-bold text-orange-500 ${protoMono.className}`}>
            {getProviderName(provider || '')} - Autorización
          </h1>
        </div>
      </header>
      
      <main className="flex-grow flex items-center justify-center p-6">
        <div className="bg-gray-800 rounded-lg p-8 shadow-xl max-w-md w-full">
          {isAuthorizing ? (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
              </div>
              <h2 className={`text-xl font-semibold mb-4 ${protoMono.className}`}>
                Autorizando {getProviderName(provider || '')}
              </h2>
              <p className="text-gray-300">
                Conectando tu cuenta de {getProviderName(provider || '')} con nuestra aplicación...
              </p>
            </div>
          ) : error ? (
            <div className="text-center">
              <div className="flex justify-center mb-6 text-4xl">
                ❌
              </div>
              <h2 className={`text-xl font-semibold mb-4 text-red-400 ${protoMono.className}`}>
                Error de autorización
              </h2>
              <p className="text-gray-300 mb-6">
                {error}
              </p>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-md text-sm transition-colors"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="flex justify-center mb-6 text-4xl">
                ✅
              </div>
              <h2 className={`text-xl font-semibold mb-4 text-green-400 ${protoMono.className}`}>
                ¡Autorización completada!
              </h2>
              <p className="text-gray-300 mb-6">
                Tu cuenta de {getProviderName(provider || '')} ha sido conectada exitosamente.
              </p>
              <div className="text-sm text-gray-400 mb-6">
                Esta ventana se cerrará automáticamente en unos segundos...
              </div>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-md text-sm transition-colors"
              >
                Cerrar manualmente
              </button>
            </div>
          )}
          
          {mock && (
            <div className="mt-8 pt-6 border-t border-gray-700">
              <div className="text-xs text-gray-500 mb-2">Información de depuración:</div>
              <div className="text-xs text-gray-400 mb-1">Provider: <span className="text-orange-400">{provider}</span></div>
              <div className="text-xs text-gray-400 mb-1">User FID: <span className="text-orange-400">{userFid}</span></div>
              <div className="text-xs text-gray-400 mb-1">Estado: <span className="text-orange-400">{isAuthorizing ? 'autorizando' : authorized ? 'autorizado' : 'error'}</span></div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * Obtiene el nombre amigable de un proveedor a partir de su identificador
 */
function getProviderName(provider: string): string {
  const providerNames: Record<string, string> = {
    'garmin': 'Garmin Connect',
    'google_fit': 'Google Fit',
    'apple_health': 'Apple Health',
    'fitbit': 'Fitbit',
    'oura': 'Oura Ring',
    'polar': 'Polar',
  };
  
  return providerNames[provider] || provider;
} 