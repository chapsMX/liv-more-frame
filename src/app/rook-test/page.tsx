'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { protoMono } from '@/styles/fonts';

export default function RookTest() {
  const [isLoading, setIsLoading] = useState(true);
  const [userFid, setUserFid] = useState<string | null>(null);

  useEffect(() => {
    // Obtener el usuario actual desde localStorage (simulación)
    // En una implementación real, obtendrías esto de tu estado de autenticación
    const storedUserFid = localStorage.getItem('currentUserFid');
    if (storedUserFid) {
      setUserFid(storedUserFid);
    }
    setIsLoading(false);
  }, []);

  const handleSetUserFid = () => {
    const input = prompt('Ingresa el user_fid para pruebas:');
    if (input) {
      localStorage.setItem('currentUserFid', input);
      setUserFid(input);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <header className="p-4 bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto">
          <h1 className={`text-2xl font-bold text-orange-500 ${protoMono.className}`}>
            Rook Integration Test Environment
          </h1>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-6">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-gray-800 rounded-lg p-6 shadow-md">
              <h2 className={`text-xl mb-4 font-semibold ${protoMono.className}`}>
                Estado de la sesión
              </h2>
              {userFid ? (
                <div className="mb-4">
                  <p>Usuario de prueba activo: <span className="text-orange-400">{userFid}</span></p>
                  <button 
                    onClick={handleSetUserFid}
                    className="mt-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm transition-colors"
                  >
                    Cambiar usuario
                  </button>
                </div>
              ) : (
                <div className="mb-4">
                  <p className="text-yellow-500">No hay usuario seleccionado para pruebas</p>
                  <button 
                    onClick={handleSetUserFid}
                    className="mt-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-md text-sm transition-colors"
                  >
                    Seleccionar usuario
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-lg p-6 shadow-md">
                <h2 className={`text-xl mb-4 font-semibold ${protoMono.className}`}>
                  Conexión con Rook
                </h2>
                <p className="mb-4 text-gray-300">
                  Conecta y gestiona tus dispositivos wearables a través de Rook.
                </p>
                <Link 
                  href="/rook-test/connections"
                  className={`inline-block px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-md text-sm ${!userFid ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Gestionar conexiones
                </Link>
              </div>

              <div className="bg-gray-800 rounded-lg p-6 shadow-md">
                <h2 className={`text-xl mb-4 font-semibold ${protoMono.className}`}>
                  Datos sincronizados
                </h2>
                <p className="mb-4 text-gray-300">
                  Visualiza los datos de actividad física sincronizados desde tus dispositivos.
                </p>
                <Link 
                  href="/rook-test/dashboard"
                  className={`inline-block px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-md text-sm ${!userFid ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Ver datos
                </Link>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-6 shadow-md">
              <h2 className={`text-xl mb-4 font-semibold ${protoMono.className}`}>
                Documentación y recursos
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a 
                  href="https://docs.tryrook.io/docs/rookconnect/introduction/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block p-4 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                >
                  <h3 className="font-semibold mb-2">Documentación oficial de Rook</h3>
                  <p className="text-sm text-gray-300">Explora la documentación completa de la API de Rook</p>
                </a>
                <a 
                  href="https://docs.tryrook.io/docs/QuickStart/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block p-4 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                >
                  <h3 className="font-semibold mb-2">Guía de inicio rápido</h3>
                  <p className="text-sm text-gray-300">Tutorial paso a paso para implementar Rook</p>
                </a>
              </div>
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