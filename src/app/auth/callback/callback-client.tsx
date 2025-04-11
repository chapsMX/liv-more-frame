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
  }, []); // Ya no dependemos de searchParams.code

  const handleClose = () => {
    // Usar la URL de ngrok desde las variables de entorno
    window.location.href = process.env.NEXT_PUBLIC_URL || '/';
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full">
        {status === 'processing' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-lg mb-4">Procesando autenticación...</p>
          </div>
        )}
        
        {status === 'success' && (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-green-600 mb-4">¡Conexión exitosa!</h2>
            
            <div className="bg-gray-50 rounded p-4 mb-4 text-left">
              <h3 className="font-semibold mb-2">Parámetros de la URL:</h3>
              <pre className="whitespace-pre-wrap break-words text-sm">
                {JSON.stringify(responseData?.urlParams, null, 2)}
              </pre>
            </div>

            <div className="bg-gray-50 rounded p-4 mb-4 text-left">
              <h3 className="font-semibold mb-2">Respuesta del servidor:</h3>
              <pre className="whitespace-pre-wrap break-words text-sm">
                {JSON.stringify(responseData?.serverResponse, null, 2)}
              </pre>
            </div>

            <button
              onClick={handleClose}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            >
              Volver a la página principal
            </button>
          </div>
        )}
        
        {status === 'error' && (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Error en la autenticación</h2>
            <p className="text-lg mb-4">{errorMessage}</p>
            
            {responseData && (
              <div className="bg-gray-50 rounded p-4 mb-4 text-left">
                <h3 className="font-semibold mb-2">Detalles del error:</h3>
                <pre className="whitespace-pre-wrap break-words text-sm">
                  {JSON.stringify(responseData, null, 2)}
                </pre>
              </div>
            )}

            <button
              onClick={handleClose}
              className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
            >
              Volver a intentar
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 