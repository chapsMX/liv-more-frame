"use client";

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { protoMono } from '../styles/fonts';
import { useUser } from '../context/UserContext';
import { useRouter } from 'next/navigation';
import { ControlPanel } from './ControlPanel';
import DGModal from './DGModal';
import sdk from "@farcaster/frame-sdk";
import { HealthMetric } from './HealthMetric';

export default function DashboardInicial() {
  const { userState, setUserState } = useUser();
  const router = useRouter();
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [pfpUrl, setPfpUrl] = useState<string>();
  const [goals, setGoals] = useState({ calories: 0, steps: 0, sleep: 0 });
  const [hasValidGoals, setHasValidGoals] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [healthMetrics, setHealthMetrics] = useState({
    steps: 0,
    calories: 0,
    sleep: 0
  });

  const checkConnection = useCallback(async () => {
    try {
      console.log('🔍 Verificando conexión con la base de datos...');
      const response = await fetch(`/api/users/check-connection?fid=${userState.userFid}`);
      const data = await response.json();
      
      if (response.ok) {
        // Si el provider es 'NULL', retornamos null para mantener consistencia
        return data.connectedProvider === 'NULL' ? null : data.connectedProvider;
      } else {
        console.error('❌ Error verificando conexión:', data.error);
        return null;
      }
    } catch (error) {
      console.error('❌ Error en la verificación de conexión:', error);
      return null;
    }
  }, [userState.userFid]);

  const checkUserGoals = useCallback(async () => {
    try {
      console.log('🎯 Verificando objetivos del usuario:', userState.userFid);
      const response = await fetch(`/api/users/check-goals?fid=${userState.userFid}`);
      const data = await response.json();
      
      if (data.hasGoals) {
        // Only update goals if they've changed
        if (JSON.stringify(goals) !== JSON.stringify(data.goals)) {
          setGoals(data.goals);
        }
        
        // Only update validation status if it's different
        if (hasValidGoals !== data.validation.isValid) {
          setHasValidGoals(data.validation.isValid);
        }
        
        console.log('✅ Estado de objetivos actualizado:', {
          goals: data.goals,
          isValid: data.validation.isValid
        });
        
        if (!data.validation.isValid) {
          console.log('⚠️ Objetivos inválidos - Mostrando modal de actualización');
          setShowGoalsModal(true);
        }
      } else {
        console.log('⚠️ Usuario sin objetivos - Mostrando modal de configuración');
        setShowGoalsModal(true);
      }
    } catch (error) {
      console.error('❌ Error verificando objetivos:', error);
    }
  }, [userState.userFid, goals, hasValidGoals]);

  useEffect(() => {
    const loadUserProfile = async () => {
      const context = await sdk.context;
      if (context.user?.pfpUrl) {
        setPfpUrl(context.user.pfpUrl);
      }
    };

    loadUserProfile();
  }, []);

  useEffect(() => {
    const checkInitialPermissions = async () => {
      setIsCheckingAccess(true);
      
      console.log('🔍 Verificando permisos básicos:', {
        isWhitelisted: userState.isWhitelisted,
        acceptedTos: userState.acceptedTos,
        acceptedPrivacyPolicy: userState.acceptedPrivacyPolicy,
        canUse: userState.canUse
      });

      if (!userState.isWhitelisted || !userState.acceptedTos || !userState.acceptedPrivacyPolicy || !userState.canUse) {
        console.log('⚠️ Acceso denegado al Dashboard - Permisos insuficientes');
        router.push('/');
        return;
      }

      console.log('✅ Permisos básicos verificados');
      setInitialCheckDone(true);
      setIsCheckingAccess(false);
    };

    if (!initialCheckDone) {
      checkInitialPermissions();
    }
  }, [userState.isWhitelisted, userState.acceptedTos, userState.acceptedPrivacyPolicy, userState.canUse, router, initialCheckDone]);

  useEffect(() => {
    const checkGoalsAndProvider = async () => {
      if (!initialCheckDone) return;
      
      setIsCheckingAccess(true);
      
      // Check goals first
      await checkUserGoals();
      
      // Only check provider if we have valid goals
      if (hasValidGoals) {
        const providerStatus = await checkConnection();
        console.log('🔍 Estado de conexión verificado:', {
          providerFromDB: providerStatus,
          hasValidGoals
        });

        // Only update provider status if it's different
        if (providerStatus !== userState.connectedProvider) {
          setUserState({
            connectedProvider: providerStatus
          });
        }

        // Redirect to device connection if no provider or provider is 'NULL'
        if (!providerStatus || providerStatus === 'NULL') {
          console.log('⚠️ Usuario sin provider conectado - Redirigiendo a RookDeviceConnection');
          router.push('/connect-device');
          return;
        }
      }

      setIsCheckingAccess(false);
    };

    checkGoalsAndProvider();
  }, [
    initialCheckDone,
    hasValidGoals,
    checkConnection,
    checkUserGoals,
    router,
    setUserState,
    userState.connectedProvider
  ]);

  useEffect(() => {
    const fetchHealthMetrics = async () => {
      if (!userState.userFid || !userState.connectedProvider) return;

      const today = new Date().toISOString().split('T')[0];
      
      try {
        console.log('🔍 Obteniendo métricas de salud para:', { user_id: userState.userFid, date: today });
        
        // Obtener resumen físico
        const physicalResponse = await fetch(`/api/users/physical-summary?user_id=${userState.userFid}&date=${today}`);
        const physicalData = await physicalResponse.json();
        
        // Obtener resumen de sueño
        const sleepResponse = await fetch(`/api/users/sleep-summary?user_id=${userState.userFid}&date=${today}`);
        const sleepData = await sleepResponse.json();

        setHealthMetrics({
          steps: physicalData.steps || 0,
          calories: physicalData.calories || 0,
          sleep: sleepData.sleep_duration_hours || 0
        });

        console.log('✅ Métricas de salud actualizadas:', {
          steps: physicalData.steps,
          calories: physicalData.calories,
          sleep: sleepData.sleep_duration_hours
        });
      } catch (error) {
        console.error('❌ Error obteniendo métricas de salud:', error);
      }
    };

    if (initialCheckDone && userState.connectedProvider) {
      fetchHealthMetrics();
    }
  }, [initialCheckDone, userState.userFid, userState.connectedProvider]);

  const handleSaveGoals = async (goals: { calories: number; steps: number; sleep: number }) => {
    try {
      const response = await fetch('/api/users/save-goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_fid: userState.userFid,
          ...goals
        }),
      });

      const data = await response.json();
      if (data.success) {
        setShowGoalsModal(false);
        setHasValidGoals(true);
      }
    } catch (error) {
      console.error('Error saving goals:', error);
    }
  };

  if (isCheckingAccess) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
        <div className="text-center">
          <p className={`text-xl ${protoMono.className}`}>Verificando acceso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Header */}
        <div className="flex justify-between items-center w-full max-w-2xl mb-2">
          <div className="flex items-center">
            <Image
              src="/livMore_w.png"
              alt="Liv More"
              width={60}
              height={60}
              priority
            />
          </div>
          
          {/* User Profile with Kebab Menu */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2 py-1 bg-gray-800 rounded-full text-white min-w-[150px] border-2 border-gray-700">
              {pfpUrl && (
                <Image
                  src={pfpUrl}
                  alt="Profile"
                  width={32}
                  height={32}
                  className="rounded-full border-2 border-gray-700"
                  unoptimized
                />
              )}
              <span className={`text-base font-semibold ${protoMono.className}`}>
                {userState.username}
              </span>
              <button 
                onClick={() => setShowControlPanel(true)}
                className="ml-2 text-gray-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <HealthMetric
            title="Daily Steps"
            value={healthMetrics.steps}
            unit="steps"
            icon="👣"
          />
          <HealthMetric
            title="Daily Calories"
            value={healthMetrics.calories}
            unit="kcal"
            icon="🔥"
          />
          <HealthMetric
            title="Sleep Duration"
            value={healthMetrics.sleep}
            unit="hours"
            icon="😴"
          />
        </div>
      </div>

      {/* Control Panel Modal */}
      {showControlPanel && (
        <ControlPanel onClose={() => setShowControlPanel(false)} />
      )}

      {/* Goals Modal */}
      {showGoalsModal && (
        <DGModal 
          onSave={handleSaveGoals}
          initialGoals={goals}
        />
      )}
    </div>
  );
}
