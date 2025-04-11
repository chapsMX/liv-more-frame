'use client';

import { useEffect, useState } from 'react';
import { protoMono } from '../../../styles/fonts';

type SearchParamsType = {
  code?: string;
  state?: string;
  error?: string;
}

interface ClientProps {
  searchParams: SearchParamsType;
}

interface ResponseData {
  urlParams?: {
    code: string;
    state: string | null;
    error: string | null;
  };
  serverResponse?: any;
  error?: string;
  errorDetails?: any;
}

export default function CallbackClient({ searchParams }: ClientProps) {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');
  const [responseData, setResponseData] = useState<ResponseData>({});

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('=== Iniciando proceso de callback en el cliente ===');
        console.log('URL completa:', window.location.href);
        
        // Obtener todos los parámetros de la URL directamente del window.location
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        const scope = urlParams.get('scope');
        
        console.log('Parámetros detallados:', {
          code: code ? `${code.substring(0, 10)}...` : 'Ausente',
          state,
          stateTipo: typeof state,
          error,
          scope
        });

        if (error) {
          throw new Error(`Error de autorización: ${error}`);
        }

        if (!code) {
          throw new Error('No se recibió código de autorización');
        }

        if (!state) {
          throw new Error('No se recibió FID en el state');
        }

        // Validar que state sea un número
        const stateNumber = parseInt(state);
        if (isNaN(stateNumber)) {
          throw new Error('El state no es un número válido');
        }

        console.log('Enviando solicitud al endpoint de callback...');
        const response = await fetch('/api/auth/google/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-fid': stateNumber.toString()
          },
          body: JSON.stringify({ code }),
        }).catch(error => {
          console.error('Error en la petición fetch:', error);
          throw error;
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Respuesta no exitosa:', response.status, errorText);
          throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('Respuesta del servidor:', data);
        setResponseData(prev => ({ ...prev, serverResponse: data }));

        if (data.success) {
          setStatus('success');
        } else {
          throw new Error(data.error || 'Error al procesar la autenticación');
        }
      } catch (error) {
        console.error('Error en el proceso de callback:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Error desconocido');
        setResponseData(prev => ({ 
          ...prev, 
          error: error instanceof Error ? error.message : 'Error desconocido',
          errorDetails: error
        }));
      }
    };

    // Iniciar el proceso inmediatamente
    handleCallback();
  }, []);

  const handleClose = () => {
    window.location.href = 'https://0f0f46525a0c.ngrok.app';
  };

  if (status === 'processing') {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin"></div>
          <p className={protoMono.className}>Procesando autenticación...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-red-500">Error: {errorMessage}</p>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <p className="text-green-500">¡Autenticación exitosa!</p>
        <button
          onClick={handleClose}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        >
          Continuar
        </button>
      </div>
    </div>
  );
} 