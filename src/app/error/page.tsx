"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { protoMono } from '../../styles/fonts';
import Link from 'next/link';

export default function ErrorPage() {
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const message = searchParams.get('message');
    let displayMessage = 'Ha ocurrido un error inesperado';

    switch (message) {
      case 'missing_user_id':
        displayMessage = 'Falta identificación de usuario en la solicitud';
        break;
      case 'connection_failed':
        displayMessage = 'Error al conectar con el proveedor de datos de salud';
        break;
      case 'database_error':
        displayMessage = 'Error al guardar la información de conexión';
        break;
      case 'server_error':
        displayMessage = 'Error interno del servidor';
        break;
      default:
        if (message) {
          displayMessage = `Error: ${message}`;
        }
    }

    setErrorMessage(displayMessage);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <div className="bg-gray-900 p-6 rounded-lg shadow-lg max-w-xl w-full text-center">
        <h1 className={`text-3xl font-bold mb-6 text-red-500 ${protoMono.className}`}>Error</h1>
        <p className={`text-xl mb-8 ${protoMono.className}`}>{errorMessage}</p>
        <div className="flex justify-center">
          <Link href="/dashboard" className={`px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors ${protoMono.className}`}>
            Volver al Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
} 