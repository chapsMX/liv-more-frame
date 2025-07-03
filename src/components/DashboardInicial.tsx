"use client";

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { protoMono } from '../styles/fonts';
import { useUser } from '../context/UserContext';
import { useRouter } from 'next/navigation';
import { ControlPanel } from './ControlPanel';
import DGModal from './DGModal';
import MintModal from './MintModal';
import { sdk } from "@farcaster/frame-sdk";
import { CaloriesIcon, StepsIcon, SleepIcon } from '../styles/svg';

// Helper para calcular fecha de finalización (comentado porque no se usa actualmente)
// function getEndDate(startDate: string, durationDays: number) {
//   const start = new Date(startDate);
//   start.setDate(start.getDate() + durationDays);
//   return start.toLocaleDateString();
// }

export default function DashboardInicial() {
  const { userState, setUserState } = useUser();
  const router = useRouter();
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [pfpUrl, setPfpUrl] = useState<string>();
  const [goals, setGoals] = useState({ calories: 0, steps: 0, sleep: 0 });
  const [userGoals, setUserGoals] = useState({
    steps_goal: 0,
    calories_goal: 0,
    sleep_hours_goal: 0
  });
  const [hasValidGoals, setHasValidGoals] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [dailyMetrics, setDailyMetrics] = useState({
    steps: 0,
    calories: 0,
    sleep: 0
  });

  const [weeklyMetrics, setWeeklyMetrics] = useState<{
    calories: { value: number; percentage: number }[];
    steps: { value: number; percentage: number }[];
    sleep: { value: number; percentage: number }[];
  }>({
    calories: Array(6).fill({ value: 0, percentage: 0 }),
    steps: Array(6).fill({ value: 0, percentage: 0 }),
    sleep: Array(6).fill({ value: 0, percentage: 0 })
  });

  const [createdAttestations, setCreatedAttestations] = useState<{ steps: boolean, calories: boolean, sleep: boolean }>({ steps: false, calories: false, sleep: false });
  const [showMintModal, setShowMintModal] = useState(false);
  
  // State para challenges oficiales
  const [officialChallenges, setOfficialChallenges] = useState<Challenge[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(true);

  // Interface para Challenge
  interface Challenge {
    id: number;
    title: string;
    activity_type: string;
    start_date: string;
    image_url?: string;
    points_value?: number;
    is_official: boolean;
  }



  // ❌ REMOVED: saveDailyActivity function - webhook handles this automatically

  // Función para sincronizar challenges activos del usuario
  const syncUserChallenges = useCallback(async (userFid: number | string, date: string) => {
    try {
      const response = await fetch('/api/challenges/sync-daily', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: date,
          user_fid: userFid
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Challenge sync completed:', result);
      } else {
        console.error('❌ Error syncing challenges:', await response.text());
      }
    } catch (error) {
      console.error('❌ Error calling challenge sync:', error);
    }
  }, []);



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
        
        // Update userGoals
        setUserGoals({
          steps_goal: data.goals.steps,
          calories_goal: data.goals.calories,
          sleep_hours_goal: data.goals.sleep
        });
        
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

  // ✅ IMPROVED: Utilidad robusta para obtener la fecha YYYY-MM-DD en la zona horaria del usuario
  function getLocalDateString(date: Date, tz: string) {
    // Usar Intl.DateTimeFormat para conversión consistente de timezone
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(date);
  }

  // ✅ OPTIMIZED: Single useEffect using local database instead of 50+ Rook API calls
  useEffect(() => {
    const fetchOptimizedHealthData = async () => {
      if (!userState.userFid || !userState.connectedProvider) return;

      try {
        console.log('🚀 [OPTIMIZED] Obteniendo datos de salud desde base de datos local para usuario:', userState.userFid);
        
        const response = await fetch(`/api/users/health-data?user_fid=${userState.userFid}`);
        
        if (!response.ok) {
          console.error('❌ Error obteniendo datos optimizados:', await response.text());
          return;
        }

        const data = await response.json();
        
        if (data.success) {
          // Actualizar métricas diarias
          setDailyMetrics(data.daily_metrics);
          
          // Actualizar métricas semanales
          setWeeklyMetrics(data.weekly_metrics);
          
          // Actualizar objetivos del usuario para cálculos
          setUserGoals(data.user_goals);

          console.log('✅ [OPTIMIZED] Datos de salud actualizados exitosamente:', {
            daily: data.daily_metrics,
            weekly_data_points: data.weekly_metrics.steps.length,
            goals: data.user_goals,
            target_date: data.target_date,
            date_type: data.date_type
          });

          // ✅ UPDATED: Usar la fecha objetivo (ayer) del API response para sincronización
          const targetDate = data.target_date || (userState.timezone 
            ? (() => {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                return getLocalDateString(yesterday, userState.timezone);
              })()
            : (() => {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                return yesterday.toISOString().split('T')[0];
              })()
          );

          // Sincronizar challenges activos para el usuario con fecha de ayer
          await syncUserChallenges(userState.userFid, targetDate);
        }
      } catch (error) {
        console.error('❌ [OPTIMIZED] Error obteniendo datos optimizados:', error);
      }
    };

    if (initialCheckDone && userState.connectedProvider) {
      fetchOptimizedHealthData();
    }
  }, [initialCheckDone, userState.userFid, userState.connectedProvider, userState.timezone, syncUserChallenges]);

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

  function calculateDailyProgress() {
    // Usar userGoals de la API optimizada
    const caloriesProgress = (dailyMetrics.calories / userGoals.calories_goal) * 100;
    const stepsProgress = (dailyMetrics.steps / userGoals.steps_goal) * 100;
    const sleepProgress = (dailyMetrics.sleep / userGoals.sleep_hours_goal) * 100;
    
    const averageProgress = Math.round((caloriesProgress + stepsProgress + sleepProgress) / 3);
    return Math.min(averageProgress, 100); // Aseguramos que no exceda el 100%
  }

  // ✅ NEW: Función para verificar si TODOS los objetivos están completados
  function areAllGoalsCompleted() {
    const caloriesCompleted = (dailyMetrics.calories / userGoals.calories_goal) >= 1;
    const stepsCompleted = (dailyMetrics.steps / userGoals.steps_goal) >= 1;
    const sleepCompleted = (dailyMetrics.sleep / userGoals.sleep_hours_goal) >= 1;
    
    return caloriesCompleted && stepsCompleted && sleepCompleted;
  }

  function getProgressMessage() {
    const progress = calculateDailyProgress();
    const allGoalsCompleted = areAllGoalsCompleted();
    
    if (allGoalsCompleted) {
      return "You crushed it yesterday! 💥 All goals completed — share your amazing achievement!";
    } else if (progress >= 86) {
      return "So close yesterday! ⚡ You were almost at 100% — keep that momentum going today!";
    } else if (progress >= 61) {
      return "Strong performance yesterday! You're building great habits.";
    } else if (progress >= 41) {
      return "Good progress yesterday! Every step counts towards your goals.";
    } else if (progress >= 21) {
      return "Yesterday was a start — today is a new opportunity to do even better! 💪";
    } else {
      return "Yesterday's behind you — today is a fresh chance to crush your goals! 💪";
    }
  }



  const handleShare = async () => {
    try {
      const imageID = userState.userFid;
      const time = Math.floor(Date.now() / 1000);
      const shareID = `${imageID}-${time}`;
      
      // ✅ UPDATED: Crear fecha de ayer para el texto
      const yesterday = userState.timezone ? (() => {
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        return yesterdayDate.toLocaleDateString('en-US', { 
          timeZone: userState.timezone,
          month: 'short',
          day: 'numeric'
        });
      })() : (() => {
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        return yesterdayDate.toLocaleDateString('en-US', { 
          month: 'short',
          day: 'numeric'
        });
      })();

      const achievementText = `🎉 I completed all my goals yesterday (${yesterday}) on @livmore!\n\n` +
        `🔥 Calories: ${dailyMetrics.calories}/${userGoals.calories_goal}\n` +
        `👣 Steps: ${dailyMetrics.steps}/${userGoals.steps_goal}\n` +
        `😴 Sleep: ${dailyMetrics.sleep}/${userGoals.sleep_hours_goal}h\n\n` +
        `💪 Turn healthy habits into rewards! 🧬`;
      
      const url = `${process.env.NEXT_PUBLIC_URL}/di-daily/${shareID}`;
      
      await sdk.actions.composeCast({
        text: achievementText,
        embeds: [url]
      });
    } catch (error) {
      console.error('Error sharing achievement:', error);
    }
  };

  // ✅ CORRECTED: Funciones para mostrar semana PREVIA a ayer (no incluyendo ayer)
  function getWeekDateRange() {
    const tz = userState.timezone || 'UTC';
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
    
    // La semana termina el día ANTES de ayer
    const endDay = new Date(today);
    endDay.setDate(today.getDate() - 2); // día antes de ayer
    
    // 6 días antes del último día (total 7 días previos a ayer)
    const startDay = new Date(endDay);
    startDay.setDate(endDay.getDate() - 6); 

    const formatDate = (date: Date) => date.toLocaleDateString('en-US', {
      timeZone: tz,
      month: 'long',
      day: 'numeric'
    });

    return `${formatDate(startDay)} - ${formatDate(endDay)}`;
  }

  function getWeekDays() {
    const tz = userState.timezone || 'UTC';
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
    const days = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Generar días desde 8 días antes hasta 2 días antes (semana previa a ayer)
    for (let i = 8; i >= 2; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      days.push(dayNames[date.getDay()]);
    }
    return days;
  }

  function calculateBarHeight(value: number, values: { value: number }[]) {
    const maxValue = Math.max(...values.map(v => v.value));
    return maxValue === 0 ? 0 : (value / maxValue) * 100;
  }

  function calculateWeeklyTotal(metric: { value: number }[]): number {
    return metric.reduce((sum, day) => sum + day.value, 0);
  }

  function calculateWeeklyAverage(metric: { value: number }[]): number {
    const total = calculateWeeklyTotal(metric);
    const daysWithActivity = metric.filter(day => day.value > 0).length;
    return daysWithActivity === 0 ? 0 : +(total / daysWithActivity).toFixed(1);
  }

  // Sincronización automática de zona horaria con Rook
  useEffect(() => {
    async function syncTimezoneIfNeeded() {
      if (!userState.userFid) return;
      // Si ya tenemos timezone válido, no hacemos nada
      if (userState.timezone && userState.timezone !== 'UTC' && userState.timezone !== '') return;
      try {
        // 1. Obtener rook_user_id
        const rookUserRes = await fetch(`/api/users/get-rook-user?fid=${userState.userFid}`);
        if (!rookUserRes.ok) return;
        const rookUserData = await rookUserRes.json();
        const rookUserId = rookUserData.rook_user_id;
        if (!rookUserId) return;
        // 2. Llamar a la API de Rook para obtener la zona horaria
        let timezone = null;
        try {
          const rookTzRes = await fetch(`https://api.rook-connect.review/api/v1/user_id/${rookUserId}/time_zone`);
          if (rookTzRes.ok) {
            const rookTzData = await rookTzRes.json();
            timezone = rookTzData.time_zone;
          }
        } catch (e) {
          console.error('Error fetching timezone from Rook:', e);
        }
        // 3. Fallback: usar timezone del navegador si Rook falla
        if (!timezone) {
          timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        }
        // 4. Guardar en backend
        const updateRes = await fetch('/api/users/update-timezone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_fid: userState.userFid, timezone })
        });
        if (updateRes.ok) {
          // (Opcional) Actualizar el contexto/local state si tienes esa lógica
          if (setUserState) setUserState({ timezone });
        }
      } catch (err) {
        console.error('Error syncing timezone:', err);
      }
    }
    syncTimezoneIfNeeded();
  }, [userState.userFid, userState.timezone, setUserState]);



  const checkExistingAttestations = useCallback(async () => {
    if (!userState.userFid) return;
    
    try {
      // ✅ UPDATED: Usar timezone del usuario para determinar "yesterday"
      const yesterday = userState.timezone ? (() => {
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        return new Intl.DateTimeFormat('en-CA', { timeZone: userState.timezone }).format(yesterdayDate);
      })() : (() => {
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        return yesterdayDate.toISOString().split('T')[0];
      })();
        
      console.log('🕐 [Attestations] Verificando attestations para ayer:', yesterday);
      
      const response = await fetch(`/api/attestations/check-today?user_fid=${userState.userFid}&date=${yesterday}`);
      const data = await response.json();
      
      if (response.ok) {
        setCreatedAttestations(data.attestations);
      }
    } catch (error) {
      console.error('Error checking existing attestations:', error);
    }
  }, [userState.userFid, userState.timezone]);

  useEffect(() => {
    checkExistingAttestations();
  }, [checkExistingAttestations]);

  // Fetch official challenges
  useEffect(() => {
    const fetchOfficialChallenges = async () => {
      setLoadingChallenges(true);
      try {
        const res = await fetch('/api/challenges');
        const data = await res.json();
        // Filter only official challenges
        const official = (data.challenges || []).filter((challenge: Challenge) => challenge.is_official);
        setOfficialChallenges(official);
      } catch (error) {
        console.error('Error fetching official challenges:', error);
        setOfficialChallenges([]);
      } finally {
        setLoadingChallenges(false);
      }
    };
    fetchOfficialChallenges();
  }, []);

  // Function to handle attestation creation via modal
  const handleAttestationCreated = (metric: 'calories' | 'steps' | 'sleep') => {
    setCreatedAttestations(prev => ({ ...prev, [metric]: true }));
  };

  // ✅ UPDATED: Function to determine eligible metrics for attestation
  const getEligibleMetrics = () => {
    return {
      calories: (dailyMetrics.calories / userGoals.calories_goal) >= 1,
      steps: (dailyMetrics.steps / userGoals.steps_goal) >= 1,
      sleep: (dailyMetrics.sleep / userGoals.sleep_hours_goal) >= 1
    };
  };

  if (isCheckingAccess) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
        <div className="text-center">
          <p className={`text-xl ${protoMono.className}`}>Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {showGoalsModal && (
        <DGModal
          onSave={handleSaveGoals}
          initialGoals={goals}
        />
      )}
      
      {!showGoalsModal && (
        <>
          <div className="container mx-auto px-4 py-2">
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

            {/* Contenido principal del dashboard */}
            <div className="flex flex-col items-center justify-center space-y-6 p-2">
              {/* Primera fila: Título */}
              <h1 className={`text-2xl font-bold text-white mb-0 ${protoMono.className}`}>
                Yesterday's Activity
              </h1>

              {/* Segunda fila: Fecha de ayer */}
              <div className={`text-xl text-gray-400 mb-4 ${protoMono.className}`}>
                {userState.timezone ? (() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  return yesterday.toLocaleDateString('en-US', { 
                    timeZone: userState.timezone,
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  });
                })() :
                (() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  return yesterday.toLocaleDateString('en-US', { 
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  });
                })()
                }
              </div>

              {/* Tercera fila: Métricas con íconos */}
              <div className="grid grid-cols-3 mb-2 gap-8 w-full max-w-4xl">
                {/* Calorías */}
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-orange-500 flex items-center justify-center bg-black">
                      <CaloriesIcon className="w-12 h-12 text-orange-500" />
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <p className={`text-lg font-bold ${protoMono.className}`}>
                      <span className="text-white">{dailyMetrics.calories}</span>
                      <span className="text-gray-500">/{goals.calories}</span>
                    </p>
                    <p className={`text-sm text-gray-400 uppercase tracking-wide ${protoMono.className}`}>
                      CALORIES
                    </p>
                  </div>
                </div>

                {/* Pasos */}
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-green-500 flex items-center justify-center bg-black">
                      <StepsIcon className="w-12 h-12 text-green-500" />
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <p className={`text-lg font-bold ${protoMono.className}`}>
                      <span className="text-white">{dailyMetrics.steps}</span>
                      <span className="text-gray-500">/{goals.steps}</span>
                    </p>
                    <p className={`text-sm text-gray-400 uppercase tracking-wide ${protoMono.className}`}>
                      STEPS
                    </p>
                  </div>
                </div>

                {/* Sueño */}
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-blue-500 flex items-center justify-center bg-black">
                      <SleepIcon className="w-12 h-12 text-blue-500" />
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <p className={`text-lg font-bold ${protoMono.className}`}>
                      <span className="text-white">{dailyMetrics.sleep}</span>
                      <span className="text-gray-500">/{goals.sleep}h</span>
                    </p>
                    <p className={`text-sm text-gray-400 uppercase tracking-wide ${protoMono.className}`}>
                      SLEEP
                    </p>
                  </div>
                </div>
              </div>

              {/* Carrusel de Official Challenges */}
              <div className="mt-2 w-full max-w-4xl mb-0">
                <div className={`relative z-10 space-y-2 mb-0 ${protoMono.className}`}>
                  <h2 className="text-2xl font-bold text-white text-center">Official Challenges</h2>
                  
                  <div className="w-full overflow-x-auto pb-2 mb-0">
                    <div className="flex flex-row gap-4 snap-x snap-mandatory overflow-x-auto px-1 mb-0">
                      {loadingChallenges ? (
                        <div className="text-gray-400 text-center py-2 w-full">Loading challenges...</div>
                      ) : officialChallenges.length === 0 ? (
                        <div className="text-gray-400 text-center py-2 w-full">No official challenges available yet.</div>
                      ) : (
                        officialChallenges.map((challenge) => (
                          <div
                            key={challenge.id}
                            className="min-w-[280px] max-w-xs bg-gray-900 border-2 border-gray-700 rounded-xl p-2 flex flex-col items-center shadow-lg cursor-pointer hover:border-violet-700 transition-colors snap-center"
                            onClick={() => router.push(`/challenges/${challenge.id}`)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => { if (e.key === 'Enter') router.push(`/challenges/${challenge.id}`); }}
                          >
                            {challenge.image_url && (
                              <div className="flex-shrink-0 mb-2">
                                <Image
                                  src={challenge.image_url}
                                  alt={challenge.title || 'Challenge'}
                                  width={120}
                                  height={120}
                                  className="mb-2object-cover"
                                  unoptimized
                                />
                              </div>
                            )}
                            <div className="flex-1 w-full flex flex-col items-center mb-0">
                              <div className="flex flex-col gap-1 mb-1">
                                <span className="text-2xs font-bold text-white py-0 text-center m-0">{challenge.title}</span>
                              </div>
                              <div className="flex flex-wrap gap-1 text-xs text-gray-300 mb-0 justify-left w-full">
                                <span className="px-1 py-0">Activity: {challenge.activity_type}</span><br/>
                                <span className="px-1 py-0">Start: {challenge.start_date ? new Date(challenge.start_date).toLocaleDateString() : '-'}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cuarta fila: Progreso de Ayer */}
              <div className="mt-2 w-full mb-0 max-w-4xl">
                <div className={`relative z-10 space-y-2 ${protoMono.className}`}>
                  <p className={`text-lg mb-0 font-bold text-white`}>
                    Yesterday's Progress: {calculateDailyProgress()}%
                  </p>
                  <p className={`text-base text-gray-300`}>
                    {getProgressMessage()}
                    {areAllGoalsCompleted() && (
                      <span 
                        onClick={handleShare}
                        className="text-violet-500 hover:text-violet-400 cursor-pointer transition-colors ml-1"
                      >
                      Share to Farcaster
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Mint Attestations Section - Show if at least one goal is completed */}
              {(
                (dailyMetrics.calories / userGoals.calories_goal) >= 1 ||
                (dailyMetrics.steps / userGoals.steps_goal) >= 1 ||
                (dailyMetrics.sleep / userGoals.sleep_hours_goal) >= 1
              ) && (
                <div className="w-full max-w-4xl space-y-4 mb-0">
                  <div className={`text-center space-y-4 ${protoMono.className}`}>
                    <div>
                      <p className={`text-lg mb-2 font-bold text-white`}>
                        Great performance yesterday! 🎉
                      </p>
                      <p className={`text-base text-gray-300 mb-4`}>
                        You achieved some of your goals yesterday. Mint attestations for your completed achievements onchain.
                      </p>
                    </div>
                    
                    <button
                      onClick={() => setShowMintModal(true)}
                      className="w-full max-w-md mx-auto py-3 px-6 rounded-xl border-2 border-[#00FF94] bg-[#1A1A1A] hover:bg-[#2A2A2A] transition-all duration-300 ease-in-out transform hover:scale-105"
                    >
                      <span className={`text-lg font-bold text-[#00FF94] ${protoMono.className}`}>
                        🏆 Mint Completed Achievements
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Quinta fila: Actividad Semanal */}
              <div className="mt-2 w-full max-w-4xl border-t border-gray-800 pt-2">
                <div className={`relative z-10 space-y-2 ${protoMono.className}`}>
                  <h2 className={`text-2xl text-center font-bold text-white mb-0`}>
                    Weekly Activity
                  </h2>
                  <div className={`text-xl text-center text-gray-400`}>
                    {getWeekDateRange()}
                  </div>

                  {/* Métricas semanales */}
                  <div className="mt-6 space-y-2">
                    {/* Calorías */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <CaloriesIcon className="w-6 h-6 text-violet-500 mr-2" />
                          <span className="text-white font-semibold">Calories</span>
                        </div>
                        <span className="text-gray-400 text-sm">
                          Week: {calculateWeeklyTotal(weeklyMetrics.calories).toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-[#0B1222] rounded-xl p-1">
                        <div className="flex justify-between h-[200px] mb-2">
                          {weeklyMetrics.calories.map((day, index) => (
                            <div key={index} className="flex flex-col items-center justify-end h-full w-full">
                              <div className="w-8 h-full relative flex items-end">
                                <div 
                                  className={`w-full rounded-sm transition-all duration-300 ease-in-out ${day.percentage >= 100 ? 'bg-green-500' : 'bg-violet-500'}`}
                                  style={{ 
                                    height: `${calculateBarHeight(day.value, weeklyMetrics.calories)}%`
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center pt-2">
                          {weeklyMetrics.calories.map((day, index) => (
                            <div key={`label-${index}`} className="flex flex-col items-center">
                              <span className="text-white text-2xs mb-0">{getWeekDays()[index]}</span>
                              <span className="text-white text-xs">{day.value.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Pasos */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <StepsIcon className="w-6 h-6 text-violet-500 mr-2" />
                          <span className="text-white font-semibold">Steps</span>
                        </div>
                        <span className="text-gray-400 text-sm">
                          Week: {calculateWeeklyTotal(weeklyMetrics.steps).toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-[#0B1222] rounded-xl p-1">
                        <div className="flex justify-between h-[200px] mb-2">
                          {weeklyMetrics.steps.map((day, index) => (
                            <div key={index} className="flex flex-col items-center justify-end h-full w-full">
                              <div className="w-8 h-full relative flex items-end">
                                <div 
                                  className={`w-full rounded-sm transition-all duration-300 ease-in-out ${day.percentage >= 100 ? 'bg-green-500' : 'bg-violet-500'}`}
                                  style={{ 
                                    height: `${calculateBarHeight(day.value, weeklyMetrics.steps)}%`
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center pt-2">
                          {weeklyMetrics.steps.map((day, index) => (
                            <div key={`label-${index}`} className="flex flex-col items-center">
                              <span className="text-white text-2xs mb-0">{getWeekDays()[index]}</span>
                              <span className="text-white text-xs">{day.value.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Sueño */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <SleepIcon className="w-6 h-6 text-violet-500 mr-2" />
                          <span className="text-white font-semibold">Sleep</span>
                        </div>
                        <span className="text-gray-400 text-sm">
                          Avg: {calculateWeeklyAverage(weeklyMetrics.sleep)}h
                        </span>
                      </div>
                      <div className="bg-[#0B1222] rounded-xl p-1">
                        <div className="flex justify-between h-[200px] mb-2">
                          {weeklyMetrics.sleep.map((day, index) => (
                            <div key={index} className="flex flex-col items-center justify-end h-full w-full">
                              <div className="w-8 h-full relative flex items-end">
                                <div 
                                  className={`w-full rounded-sm transition-all duration-300 ease-in-out ${day.percentage >= 100 ? 'bg-green-500' : 'bg-violet-500'}`}
                                  style={{ 
                                    height: `${calculateBarHeight(day.value, weeklyMetrics.sleep)}%`
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center pt-2">
                          {weeklyMetrics.sleep.map((day, index) => (
                            <div key={`label-${index}`} className="flex flex-col items-center">
                              <span className="text-white text-2xs mb-1">{getWeekDays()[index]}</span>
                              <span className="text-white text-xs">{`${day.value}h`}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Control Panel Modal */}
          {showControlPanel && (
            <ControlPanel onClose={() => setShowControlPanel(false)} />
          )}

          {/* Mint Attestations Modal */}
          {showMintModal && (
            <MintModal
              onClose={() => setShowMintModal(false)}
              eligibleMetrics={getEligibleMetrics()}
              dailyMetrics={dailyMetrics}
              userGoals={userGoals}
              createdAttestations={createdAttestations}
              onAttestationCreated={handleAttestationCreated}
            />
          )}
        </>
      )}
    </div>
  );
}
