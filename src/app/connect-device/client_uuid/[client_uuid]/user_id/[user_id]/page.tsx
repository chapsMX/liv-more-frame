'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function RookCallbackPage() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    // Extraer los parámetros de la URL
    const { client_uuid, user_id } = params;
    
    // Redirigir a la página principal de conexión con los parámetros
    if (client_uuid && user_id) {
      console.log('🔄 Redirigiendo con parámetros:', { client_uuid, user_id });
      router.replace(`/connect-device?client_uuid=${client_uuid}&user_id=${user_id}&from_redirect=true`);
    } else {
      console.log('⚠️ Parámetros faltantes en la URL');
      router.replace('/connect-device');
    }
  }, [router, params]);

  // Mostrar un mensaje de carga mientras se procesa la redirección
  return (
    <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin mb-4"></div>
        <p>Processing connection...</p>
      </div>
    </div>
  );
} 