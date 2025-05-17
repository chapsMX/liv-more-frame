'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import RookDeviceConnection from '@/components/RookDeviceConnection';
import { useUser } from '@/context/UserContext';

export default function ConnectDevicePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { userState } = useUser();

  useEffect(() => {
    // Verificar si el usuario tiene los permisos necesarios
    if (!userState.isWhitelisted || !userState.acceptedTos || !userState.acceptedPrivacyPolicy || !userState.canUse) {
      console.log('⚠️ Usuario sin permisos necesarios - Redirigiendo a home');
      router.push('/');
      return;
    }

    // Verificar si estamos en una redirección de Rook
    const isRookCallback = pathname.includes('client_uuid') || 
                         (searchParams.get('provider') && searchParams.get('userId'));

    if (isRookCallback) {
      console.log('🔄 Detectada redirección de Rook - Procesando callback');
    }
  }, [pathname, searchParams, router, userState]);

  return <RookDeviceConnection />;
} 