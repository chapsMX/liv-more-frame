'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { protoMono } from '@/styles/fonts';

interface DataSource {
  name: string;
  provider: string;
  icon: string;
  status: 'connected' | 'disconnected';
  lastSync?: string;
}

const mockDataSources: DataSource[] = [
  {
    name: 'Garmin Connect',
    provider: 'garmin',
    icon: '🏃‍♂️',
    status: 'disconnected'
  },
  {
    name: 'Google Fit',
    provider: 'google_fit',
    icon: '🧘‍♂️',
    status: 'disconnected'
  },
  {
    name: 'Apple Health',
    provider: 'apple_health',
    icon: '❤️',
    status: 'disconnected'
  },
  {
    name: 'Fitbit',
    provider: 'fitbit',
    icon: '⌚',
    status: 'disconnected'
  },
  {
    name: 'Oura Ring',
    provider: 'oura',
    icon: '💍',
    status: 'disconnected'
  },
  {
    name: 'Polar',
    provider: 'polar',
    icon: '🧊',
    status: 'disconnected'
  }
];

export default function RookConnections() {
  const [isLoading, setIsLoading] = useState(true);
  const [userFid, setUserFid] = useState<string | null>(null);
  const [dataSources, setDataSources] = useState<DataSource[]>(mockDataSources);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Obtener el usuario actual desde localStorage (simulación)
    const storedUserFid = localStorage.getItem('currentUserFid');
    if (storedUserFid) {
      setUserFid(storedUserFid);
      fetchConnections(storedUserFid);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchConnections = async (userFid: string) => {
    try {
      // En producción, aquí harías una llamada a tu API para obtener el estado de las conexiones
      // const response = await fetch(`/api/rook/connections?user_fid=${userFid}`);
      // const data = await response.json();
      
      // Por ahora, simulamos un pequeño retraso y usamos datos mock
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulamos cargar las conexiones del usuario
      const updatedSources = [...mockDataSources];
      // Por ejemplo, simulamos que Garmin ya está conectado
      if (userFid) {
        const garminIndex = updatedSources.findIndex(ds => ds.provider === 'garmin');
        if (garminIndex !== -1) {
          updatedSources[garminIndex].status = 'connected';
          updatedSources[garminIndex].lastSync = '2023-10-20T15:30:00Z';
        }
      }
      
      setDataSources(updatedSources);
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching connections:', err);
      setError('Error al cargar las conexiones. Por favor, intenta nuevamente.');
      setIsLoading(false);
    }
  };

  const handleConnect = async (provider: string) => {
    if (!userFid) return;
    
    setIsConnecting(provider);
    setError(null);
    
    try {
      // En producción, aquí harías una llamada a tu API para iniciar el proceso de conexión
      console.log(`Iniciando conexión con ${provider} para el usuario ${userFid}`);
      
      // Aquí se llamaría a la API para iniciar el proceso de conexión con Rook
      const response = await fetch(`/api/rook/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_fid: userFid,
          provider: provider
        }),
      });
      
      if (!response.ok) {
        throw new Error('Error al iniciar la conexión');
      }
      
      const data = await response.json();
      
      // Si tenemos una URL de autorización, abrimos una nueva ventana
      if (data.url) {
        // Abrimos la ventana de autorización de Rook
        const authWindow = window.open(data.url, 'Rook Authorization', 'width=600,height=600');
        
        if (!authWindow) {
          throw new Error('No se pudo abrir la ventana de autorización. Verifica que no esté bloqueada por el navegador.');
        }
        
        // Simulamos una conexión exitosa después de 3 segundos (solo para pruebas)
        setTimeout(() => {
          // Simulamos que la conexión fue exitosa
          const updatedSources = [...dataSources];
          const sourceIndex = updatedSources.findIndex(ds => ds.provider === provider);
          if (sourceIndex !== -1) {
            updatedSources[sourceIndex].status = 'connected';
            updatedSources[sourceIndex].lastSync = new Date().toISOString();
          }
          setDataSources(updatedSources);
          setIsConnecting(null);
        }, 3000);
      }
    } catch (err) {
      console.error(`Error connecting to ${provider}:`, err);
      setError(`Error al conectar con ${provider}. Por favor, intenta nuevamente.`);
      setIsConnecting(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    if (!userFid) return;
    
    setIsConnecting(provider);
    setError(null);
    
    try {
      // En producción, aquí harías una llamada a tu API para desconectar el proveedor
      console.log(`Desconectando ${provider} para el usuario ${userFid}`);
      
      // Simular una desconexión exitosa
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const updatedSources = [...dataSources];
      const sourceIndex = updatedSources.findIndex(ds => ds.provider === provider);
      if (sourceIndex !== -1) {
        updatedSources[sourceIndex].status = 'disconnected';
        delete updatedSources[sourceIndex].lastSync;
      }
      setDataSources(updatedSources);
      setIsConnecting(null);
    } catch (err) {
      console.error(`Error disconnecting from ${provider}:`, err);
      setError(`Error al desconectar de ${provider}. Por favor, intenta nuevamente.`);
      setIsConnecting(null);
    }
  };

  if (!userFid && !isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-900 text-white">
        <header className="p-4 bg-gray-800 border-b border-gray-700">
          <div className="container mx-auto">
            <h1 className={`text-2xl font-bold text-orange-500 ${protoMono.className}`}>
              Rook - Conexiones
            </h1>
          </div>
        </header>

        <main className="flex-grow container mx-auto p-6">
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-yellow-500 mb-4">
              No hay usuario seleccionado
            </h2>
            <p className="mb-6">
              Para gestionar conexiones, debes seleccionar un usuario de prueba.
            </p>
            <Link 
              href="/rook-test"
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-md text-sm transition-colors"
            >
              Volver e iniciar sesión
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <header className="p-4 bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto">
          <div className="flex justify-between items-center">
            <h1 className={`text-2xl font-bold text-orange-500 ${protoMono.className}`}>
              Rook - Conexiones
            </h1>
            <Link
              href="/rook-test"
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-6">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
                <p className="text-red-400">{error}</p>
              </div>
            )}
            
            <div className="bg-gray-800 rounded-lg p-6 shadow-md mb-6">
              <h2 className={`text-xl mb-4 font-semibold ${protoMono.className}`}>
                Conexiones de dispositivos
              </h2>
              <p className="text-gray-300 mb-4">
                Conecta tus dispositivos de actividad física y salud para sincronizar tus datos.
              </p>
              
              {userFid && (
                <p className="mb-4 text-sm text-gray-400">
                  Usuario: <span className="text-orange-400">{userFid}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dataSources.map((source) => (
                <div 
                  key={source.provider}
                  className={`
                    bg-gray-800 rounded-lg p-6 shadow-md border-l-4
                    ${source.status === 'connected' ? 'border-green-500' : 'border-gray-600'}
                  `}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{source.icon}</span>
                      <div>
                        <h3 className="font-semibold">{source.name}</h3>
                        {source.status === 'connected' && source.lastSync && (
                          <p className="text-xs text-gray-400 mt-1">
                            Última sincronización: {new Date(source.lastSync).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      {source.status === 'connected' ? (
                        <button
                          onClick={() => handleDisconnect(source.provider)}
                          disabled={isConnecting === source.provider}
                          className={`
                            px-4 py-2 rounded-md text-sm transition-colors
                            ${isConnecting === source.provider 
                              ? 'bg-red-900/50 text-gray-300 cursor-wait' 
                              : 'bg-red-700 hover:bg-red-600'}
                          `}
                        >
                          {isConnecting === source.provider ? 'Desconectando...' : 'Desconectar'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConnect(source.provider)}
                          disabled={isConnecting === source.provider}
                          className={`
                            px-4 py-2 rounded-md text-sm transition-colors
                            ${isConnecting === source.provider 
                              ? 'bg-orange-900/50 text-gray-300 cursor-wait' 
                              : 'bg-orange-600 hover:bg-orange-500'}
                          `}
                        >
                          {isConnecting === source.provider ? 'Conectando...' : 'Conectar'}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <div className="flex justify-between items-center text-sm mb-1">
                      <span>Estado:</span>
                      <span 
                        className={`px-2 py-1 rounded text-xs ${
                          source.status === 'connected' 
                            ? 'bg-green-900/30 text-green-400' 
                            : 'bg-gray-700 text-gray-300'
                        }`}
                      >
                        {source.status === 'connected' ? 'Conectado' : 'Desconectado'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="container mx-auto text-gray-400 text-sm">
          <p>Entorno de prueba para integración con Rook Connect</p>
        </div>
      </footer>
    </div>
  );
} 