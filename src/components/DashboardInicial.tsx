"use client";

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { protoMono } from '../styles/fonts';
import { useUser } from '../context/UserContext';
import { useRouter } from 'next/navigation';
import { ControlPanel } from './ControlPanel';
import DGModal from './DGModal';
import sdk from "@farcaster/frame-sdk";
import { CaloriesIcon, StepsIcon, SleepIcon } from '../styles/svg';

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

  const [weeklyMetrics, setWeeklyMetrics] = useState<{
    calories: { value: number; percentage: number }[];
    steps: { value: number; percentage: number }[];
    sleep: { value: number; percentage: number }[];
  }>({
    calories: Array(6).fill({ value: 0, percentage: 0 }),
    steps: Array(6).fill({ value: 0, percentage: 0 }),
    sleep: Array(6).fill({ value: 0, percentage: 0 })
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
        // Primero obtener el rook_user_id
        const rookUserResponse = await fetch(`/api/users/get-rook-user?fid=${userState.userFid}`);
        if (!rookUserResponse.ok) {
          console.error('❌ Error obteniendo rook_user_id');
          return;
        }
        
        const rookUserData = await rookUserResponse.json();
        const rookUserId = rookUserData.rook_user_id;
        
        console.log('🔍 Obteniendo métricas de salud para:', { rook_user_id: rookUserId, date: today });
        
        // Obtener resumen físico
        const physicalResponse = await fetch(`/api/users/physical-summary?user_id=${rookUserId}&date=${today}`);
        const physicalData = await physicalResponse.json();
        
        // Obtener resumen de sueño
        const sleepResponse = await fetch(`/api/users/sleep-summary?user_id=${rookUserId}&date=${today}`);
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

  useEffect(() => {
    const fetchWeeklyMetrics = async () => {
      if (!userState.userFid || !userState.connectedProvider) return;

      try {
        const rookUserResponse = await fetch(`/api/users/get-rook-user?fid=${userState.userFid}`);
        if (!rookUserResponse.ok) {
          console.error('❌ Error obteniendo rook_user_id para métricas semanales');
          return;
        }
        
        const rookUserData = await rookUserResponse.json();
        const rookUserId = rookUserData.rook_user_id;
        
        // Obtener datos para los últimos 6 días
        const today = new Date();
        const weeklyData: {
          calories: { value: number; percentage: number }[];
          steps: { value: number; percentage: number }[];
          sleep: { value: number; percentage: number }[];
        } = {
          calories: [],
          steps: [],
          sleep: []
        };

        for (let i = 6; i >= 1; i--) {
          const date = new Date(today);
          date.setDate(today.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];

          // Obtener datos físicos
          const physicalResponse = await fetch(`/api/users/physical-summary?user_id=${rookUserId}&date=${dateStr}`);
          const physicalData = await physicalResponse.json();
          
          // Obtener datos de sueño
          const sleepResponse = await fetch(`/api/users/sleep-summary?user_id=${rookUserId}&date=${dateStr}`);
          const sleepData = await sleepResponse.json();

          // Calcular porcentajes
          const caloriesPercentage = Math.min((physicalData.calories / goals.calories) * 100, 100);
          const stepsPercentage = Math.min((physicalData.steps / goals.steps) * 100, 100);
          const sleepPercentage = Math.min((sleepData.sleep_duration_hours / goals.sleep) * 100, 100);

          weeklyData.calories.push({ 
            value: physicalData.calories || 0,
            percentage: caloriesPercentage || 0
          });
          weeklyData.steps.push({ 
            value: physicalData.steps || 0,
            percentage: stepsPercentage || 0
          });
          weeklyData.sleep.push({ 
            value: sleepData.sleep_duration_hours || 0,
            percentage: sleepPercentage || 0
          });
        }

        setWeeklyMetrics(weeklyData);
      } catch (error) {
        console.error('❌ Error obteniendo métricas semanales:', error);
      }
    };

    if (initialCheckDone && userState.connectedProvider) {
      fetchWeeklyMetrics();
    }
  }, [initialCheckDone, userState.userFid, userState.connectedProvider, goals]);

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
    const caloriesProgress = (healthMetrics.calories / goals.calories) * 100;
    const stepsProgress = (healthMetrics.steps / goals.steps) * 100;
    const sleepProgress = (healthMetrics.sleep / goals.sleep) * 100;
    
    const averageProgress = Math.round((caloriesProgress + stepsProgress + sleepProgress) / 3);
    return Math.min(averageProgress, 100); // Aseguramos que no exceda el 100%
  }

  function getProgressMessage() {
    const progress = calculateDailyProgress();
    
    if (progress === 100) {
      return "You crushed it! 💥 Daily goal completed — now share that win with the world!";
    } else if (progress >= 86) {
      return "Final stretch! ⚡ Push through and hit that 100% — you're almost there!";
    } else if (progress >= 61) {
      return "So close! Keep moving, you're on the edge of greatness.";
    } else if (progress >= 41) {
      return "Solid progress! You've got momentum — keep it going.";
    } else if (progress >= 21) {
      return "Your day is picking up — now's the time to build the habit!";
    } else {
      return "Every journey starts with a single step. Let's get moving! 💪";
    }
  }

  const handleShare = async () => {
    try {
      const achievementText = `🎉 I completed my daily goals on @livmore!\n\n` +
        `🔥 Calories: ${healthMetrics.calories}/${goals.calories}\n` +
        `👣 Steps: ${healthMetrics.steps}/${goals.steps}\n` +
        `😴 Sleep: ${healthMetrics.sleep}/${goals.sleep}h\n\n` +
        `💪 Turn healthy habits into rewards! 🧬`;
      
      const url = "https://app.livmore.life";
      
      await sdk.actions.openUrl(
        `https://warpcast.com/~/compose?text=${encodeURIComponent(achievementText)}&embeds[]=${encodeURIComponent(url)}`
      );
    } catch (error) {
      console.error('Error sharing achievement:', error);
    }
  };

  function getWeekDateRange() {
    const today = new Date();
    const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
    
    // Calculate the start of the week (Monday)
    const monday = new Date(today);
    monday.setDate(today.getDate() - currentDay + (currentDay === 0 ? -6 : 1));
    
    // Calculate the end of the week (Sunday), excluding today
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - 1); // Yesterday
    
    // Format dates
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { 
        month: 'long',
        day: 'numeric'
      });
    };
    
    return `${formatDate(monday)} - ${formatDate(sunday)}`;
  }

  function getWeekDays() {
    const today = new Date();
    const days = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    for (let i = 6; i >= 1; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      days.push(dayNames[date.getDay() === 0 ? 6 : date.getDay() - 1]);
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
          <div className="container mx-auto px-4 py-8">
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
                Daily Activity
              </h1>

              {/* Segunda fila: Fecha actual */}
              <div className={`text-xl text-gray-400 mb-4 ${protoMono.className}`}>
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
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
                      <span className="text-white">{healthMetrics.calories}</span>
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
                      <span className="text-white">{healthMetrics.steps}</span>
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
                      <span className="text-white">{healthMetrics.sleep}</span>
                      <span className="text-gray-500">/{goals.sleep}h</span>
                    </p>
                    <p className={`text-sm text-gray-400 uppercase tracking-wide ${protoMono.className}`}>
                      SLEEP
                    </p>
                  </div>
                </div>
              </div>

              {/* Cuarta fila: Progreso Diario */}
              <div className="mt-2 w-full mb-0 max-w-4xl">
                <div className={`relative z-10 space-y-2 ${protoMono.className}`}>
                  <p className={`text-lg mb-0 font-bold text-white`}>
                    Daily Progress: {calculateDailyProgress()}%
                  </p>
                  <p className={`text-base text-gray-300`}>
                    {getProgressMessage()}
                    {calculateDailyProgress() === 100 && (
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
                  <div className="mt-6 space-y-6">
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
                      <div className="bg-[#0B1222] rounded-xl p-6">
                        <div className="flex justify-between h-[200px] mb-4">
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
                        <div className="grid grid-cols-6 gap-1 text-center pt-2">
                          {weeklyMetrics.calories.map((day, index) => (
                            <div key={`label-${index}`} className="flex flex-col items-center">
                              <span className="text-gray-400 text-sm mb-1">{getWeekDays()[index]}</span>
                              <span className="text-gray-500 text-sm">{day.value.toLocaleString()}</span>
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
                      <div className="bg-[#0B1222] rounded-xl p-6">
                        <div className="flex justify-between h-[200px] mb-4">
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
                        <div className="grid grid-cols-6 gap-1 text-center pt-2">
                          {weeklyMetrics.steps.map((day, index) => (
                            <div key={`label-${index}`} className="flex flex-col items-center">
                              <span className="text-gray-400 text-sm mb-1">{getWeekDays()[index]}</span>
                              <span className="text-gray-500 text-sm">{day.value.toLocaleString()}</span>
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
                      <div className="bg-[#0B1222] rounded-xl p-6">
                        <div className="flex justify-between h-[200px] mb-4">
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
                        <div className="grid grid-cols-6 gap-1 text-center pt-2">
                          {weeklyMetrics.sleep.map((day, index) => (
                            <div key={`label-${index}`} className="flex flex-col items-center">
                              <span className="text-gray-400 text-sm mb-1">{getWeekDays()[index]}</span>
                              <span className="text-gray-500 text-sm">{`${day.value}h`}</span>
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
        </>
      )}
    </div>
  );
}
