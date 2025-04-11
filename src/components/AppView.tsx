import { useEffect, useState } from 'react';
import Image from 'next/image';
import { protoMono } from '../styles/fonts';
import { Boton } from '../styles/ui/boton';
import Goals from './Goals';

interface AppViewProps {
  username: string;
  displayName?: string;
  onConnectGoogle: () => void;
}

interface ConnectionStatus {
  isConnected: boolean;
  connection?: {
    hasToken: boolean;
    tokenExpiry: string;
    updatedAt: string;
  };
}

export default function AppView({ username, displayName, onConnectGoogle }: AppViewProps) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleGoogleConnect = async () => {
    try {
      console.log('=== Iniciando conexión con Google ===');
      
      // Obtener el FID del usuario
      const response = await fetch(`/api/neynar?fid=${username}`);
      const userData = await response.json();
      
      console.log('Datos del usuario:', userData);
      
      if (userData.success && userData.user) {
        const userFid = userData.user.fid;
        console.log('FID del usuario:', userFid);
        
        // Obtener la URL de autenticación con el FID
        const authResponse = await fetch(`/api/auth/google/url?user_fid=${userFid}`);
        const authData = await authResponse.json();
        
        console.log('URL de autenticación:', authData);
        
        if (authData.url) {
          console.log('Redirigiendo a Google...');
          window.location.href = authData.url;
        } else {
          console.error('No se recibió URL de autenticación');
        }
      } else {
        console.error('No se pudo obtener el FID del usuario');
      }
    } catch (error) {
      console.error('Error al conectar con Google:', error);
    }
  };

  useEffect(() => {
    const checkConnection = async () => {
      try {
        // First get user info by username
        const response = await fetch(`/api/neynar?username=${username}`);
        const userData = await response.json();
        
        if (userData.success && userData.user) {
          const userFid = userData.user.fid;
          
          // Check connection status
          const connectionResponse = await fetch(`/api/auth/check-connection?user_fid=${userFid}`);
          const connectionData = await connectionResponse.json();
          console.log('Connection status:', connectionData);
          setConnectionStatus(connectionData);

          // Si está conectado, verificar objetivos y redirigir
          if (connectionData.isConnected) {
            const goalsResponse = await fetch(`/api/goals/check?user_fid=${userFid}`);
            const goalsData = await goalsResponse.json();

            // Redirigir a la página principal con el fid
            window.location.href = `/?fid=${userFid}`;
          }
        }
      } catch (error) {
        console.error('Error checking connection:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkConnection();
  }, [username]);

  // Añadir un listener para el evento de autenticación exitosa
  useEffect(() => {
    const handleAuthSuccess = () => {
      // Forzar una nueva verificación de la conexión
      setIsLoading(true);
      const checkConnection = async () => {
        try {
          const response = await fetch(`/api/neynar?username=${username}`);
          const userData = await response.json();
          
          if (userData.success && userData.user) {
            const userFid = userData.user.fid;
            const connectionResponse = await fetch(`/api/auth/check-connection?user_fid=${userFid}`);
            const data = await connectionResponse.json();
            
            if (data.isConnected) {
              // Redirigir a la página principal con el fid
              window.location.href = `/?fid=${userFid}`;
            } else {
              setConnectionStatus(data);
            }
          }
        } catch (error) {
          console.error('Error verificando conexión:', error);
        } finally {
          setIsLoading(false);
        }
      };
      checkConnection();
    };

    // Escuchar el evento de autenticación exitosa
    window.addEventListener('auth-success', handleAuthSuccess);

    return () => {
      window.removeEventListener('auth-success', handleAuthSuccess);
    };
  }, [username]);

  const handleSaveGoals = async (goals: { steps: number; sleep: number; calories: number }) => {
    console.log('Objetivos a guardar:', goals);
    // Aquí implementaremos la llamada al API para guardar los objetivos
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin"></div>
          <p className={protoMono.className}>Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col">
      <main className="flex-1 flex items-center justify-center p-2">
        <div className="flex flex-col items-center gap-2 max-w-2xl w-full">
          <Image
            src="/livMore_w.png"
            alt="Liv More"
            width={75}
            height={75}
            priority
            className="mb-4"
          />
          
          <div className={`text-center ${protoMono.className} space-y-2`}>
            <h2 className="text-2xl font-bold">
              {displayName || username}, welcome to the LivMore beta testing program.
            </h2>
            <div className="space-y-4 text-gray-300">
              <p>Please select your data provider, for the moment only Fitness by Google is available.</p>
              <p>After selecting your data provider you will be prompted for your daily goals, they can be changed any time later.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full max-w-xl mt-4">
            {/* Oura Ring - Deshabilitado */}
            <Boton
              disabled
              className="border-2 border-gray-800 bg-gray-900/50 flex items-center justify-center gap-2 py-4 px-6 rounded opacity-50 cursor-not-allowed"
            >
              <span className={`text-base font-semibold ${protoMono.className}`}>Oura Ring</span>
            </Boton>

            {/* Garmin - Deshabilitado */}
            <Boton
              disabled
              className="border-2 border-gray-800 bg-gray-900/50 flex items-center justify-center gap-2 py-4 px-6 rounded opacity-50 cursor-not-allowed"
            >
              <span className={`text-base font-semibold ${protoMono.className}`}>Garmin Connect</span>
            </Boton>

            {/* Whoop - Deshabilitado */}
            <Boton
              disabled
              className="border-2 border-gray-800 bg-gray-900/50 flex items-center justify-center gap-2 py-4 px-6 rounded opacity-50 cursor-not-allowed"
            >
              <span className={`text-base font-semibold ${protoMono.className}`}>Whoop</span>
            </Boton>

            {/* Google Fit */}
            <Boton
              onClick={onConnectGoogle}
              className={`border-2 border-gray-800 flex items-center justify-center gap-2 py-4 px-6 rounded transition-colors ${
                connectionStatus?.isConnected 
                  ? 'bg-green-900/50 cursor-not-allowed' 
                  : 'bg-gray-900 hover:bg-gray-800'
              }`}
              disabled={connectionStatus?.isConnected}
            >
              <span className={`text-base font-semibold ${protoMono.className}`}>
                {connectionStatus?.isConnected ? 'Google Fit (Connected)' : 'Google Fit'}
              </span>
            </Boton>
          </div>

          {connectionStatus?.isConnected && (
            <div className="mt-4 text-center text-gray-400">
              <p className={protoMono.className}>
                Conectado el: {new Date(connectionStatus.connection?.updatedAt || '').toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="w-full overflow-hidden py-2 mb-2">
        <div className="relative flex flex-col gap-0.5">
          <p className="text-center text-gray-400 text-sm">
            made with <span className="text-red-500 text-lg">❤</span> during ETH Denver
          </p>
        </div>
      </footer>
    </div>
  );
} 