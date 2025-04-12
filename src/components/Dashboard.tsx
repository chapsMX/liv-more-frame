"use client";

import { useEffect, useState } from "react";
import { protoMono } from '../styles/fonts';
import { CaloriesIcon, StepsIcon, SleepIcon } from '../styles/svg/index';
import sdk, { type Context } from "@farcaster/frame-sdk";
import GoalsModal from './GoalsModal';
import ConnectDeviceModal from './ConnectDeviceModal';
import Image from 'next/image';
import Loader from './Loader';

interface UserGoals {
  calories_goal: number;
  steps_goal: number;
  sleep_hours_goal: number;
}

interface ActivityData {
  calories: number;
  steps: number;
  sleepHours: number;
}

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [hasGoals, setHasGoals] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [userFid, setUserFid] = useState('');
  const [weeklyStats, setWeeklyStats] = useState<Array<{
    date: string;
    calories: number;
    steps: number;
    sleep: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkUserGoals = async () => {
    try {
      if (!userFid) {
        console.log('FID no disponible en el estado del Dashboard');
        return;
      }

      setIsTransitioning(true);
      const response = await fetch(`/api/goals/check?user_fid=${userFid}`);
      const data = await response.json();
      
      if (data.hasGoals) {
        setGoals(data.goals);
        setHasGoals(true);
        setShowGoalsModal(false);
      } else {
        setShowGoalsModal(true);
      }
    } catch (error) {
      console.error('Error checking user goals:', error);
    } finally {
      setIsTransitioning(false);
    }
  };

  const checkUserConnection = async () => {
    try {
      if (!userFid) return;

      setIsTransitioning(true);
      const response = await fetch(`/api/auth/check-connection?user_fid=${userFid}`);
      const data = await response.json();
      
      if (data.isConnected) {
        setIsConnected(true);
        setShowConnectModal(false);
      } else if (hasGoals) {
        setShowConnectModal(true);
      }
    } catch (error) {
      console.error('Error checking user connection:', error);
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleSaveGoals = async (newGoals: { calories: number; steps: number; sleep: number }) => {
    try {
      if (!userFid) return;

      const response = await fetch('/api/goals/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_fid: userFid,
          calories_goal: newGoals.calories,
          steps_goal: newGoals.steps,
          sleep_hours_goal: newGoals.sleep
        }),
      });

      const data = await response.json();
      if (data.success) {
        setGoals({
          calories_goal: newGoals.calories,
          steps_goal: newGoals.steps,
          sleep_hours_goal: newGoals.sleep
        });
        setHasGoals(true);
        setShowGoalsModal(false);
      }
    } catch (error) {
      console.error('Error saving goals:', error);
    }
  };

  const handleConnectDevice = async (provider: string) => {
    try {
      if (provider === 'google') {
        setIsConnected(true);
        setShowConnectModal(false);
      }
    } catch (error) {
      console.error('Error connecting device:', error);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const fetchActivityData = async () => {
    try {
      if (!userFid) {
        console.log('No hay userFid disponible para fetchActivityData');
        return;
      }

      console.log('Iniciando fetchActivityData para userFid:', userFid);
      
      const response = await fetch(`/api/fitness/activity?user_fid=${userFid}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Error al obtener datos de actividad: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Datos recibidos de actividad:', data);

      if (!data.success) {
        throw new Error(data.error || 'Error en la respuesta del servidor');
      }

      if (!data.activity) {
        throw new Error('No se encontraron datos de actividad');
      }

      setActivity(data.activity);
      console.log('Datos de actividad actualizados:', data.activity);
    } catch (error) {
      console.error('Error detallado en fetchActivityData:', error);
      if (error instanceof Error) {
        console.error('Stack trace:', error.stack);
      }
    }
  };

  const renderProgressBars = (
    title: string,
    data: { date: string; value: number }[],
    goal: number,
    unit: string
  ) => {
    return (
      <div className="mb-8">
        <h3 className={`text-lg font-bold mb-3 ${protoMono.className}`}>{title}</h3>
        <div className="grid grid-cols-7 gap-2">
          {/* Days of week */}
          {data.map((day, index) => (
            <div key={`day-${index}`} className={`text-center ${protoMono.className}`}>
              <div className="text-gray-500 text-xs mb-1">
                {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
            </div>
          ))}

          {/* Progress bars */}
          {data.map((day, index) => {
            const percentage = (day.value / goal) * 100;
            const isComplete = percentage >= 100;
            return (
              <div key={`bar-${index}`} className="flex flex-col items-center">
                <div className="h-24 w-full relative flex items-end">
                  <div 
                    className={`w-full rounded-t-sm transition-all ${isComplete ? 'bg-green-500' : 'bg-violet-500'}`}
                    style={{ height: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                <div className={`text-xs mt-1 ${protoMono.className} text-gray-400`}>
                  {day.value.toLocaleString()}{title === "Calories" ? "" : unit}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const fetchWeeklyData = async () => {
    try {
      if (!userFid) {
        console.log('No hay userFid disponible para fetchWeeklyData');
        return;
      }

      console.log('Iniciando fetchWeeklyData para userFid:', userFid);
      
      const response = await fetch(`/api/fitness/weekly?user_fid=${userFid}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response weekly:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Error al obtener datos semanales: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Datos recibidos semanales:', data);

      if (!data.success) {
        throw new Error(data.error || 'Error en la respuesta del servidor');
      }

      setWeeklyStats(data.data);
      console.log('Datos semanales actualizados:', data.data);
    } catch (error) {
      console.error('Error detallado en fetchWeeklyData:', error);
      if (error instanceof Error) {
        console.error('Stack trace:', error.stack);
      }
      setError(error instanceof Error ? error.message : 'Error al cargar datos semanales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const context = await sdk.context;
        console.log('Dashboard context:', context);
        setContext(context);
        
        if (context.user?.fid) {
          const fid = context.user.fid.toString();
          console.log('Dashboard FID:', fid);
          setUserFid(fid);
        } else {
          console.log('Esperando FID en Dashboard...');
        }
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (userFid) {
      checkUserGoals();
      checkUserConnection();
      fetchActivityData();
      fetchWeeklyData();
    }
  }, [userFid]);

  useEffect(() => {
    if (userFid) {
      fetchActivityData();
      fetchWeeklyData();
      const activityInterval = setInterval(fetchActivityData, 60000);
      const weeklyInterval = setInterval(fetchWeeklyData, 300000); // 5 minutos
      return () => {
        clearInterval(activityInterval);
        clearInterval(weeklyInterval);
      };
    }
  }, [userFid]);

  if (isLoading) {
    return <Loader message="Loading dashboard..." />;
  }

  if (isTransitioning) {
    return <Loader message="Updating your data..." />;
  }

  if (!hasGoals) {
    return <GoalsModal onSave={handleSaveGoals} />;
  }

  if (!isConnected) {
    return (
      <ConnectDeviceModal
        onClose={() => setShowConnectModal(false)}
        onConnect={handleConnectDevice}
        userFid={userFid}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <main className="container mx-auto px-4 py-8">
        {/* Header - Fila 1 */}
        <div className="flex justify-between items-center w-full max-w-2xl mb-6 mx-auto">
          <div className="flex items-center">
            <Image
              src="/livMore_w.png"
              alt="Liv More"
              width={64}
              height={64}
              priority
            />
          </div>
          {context?.user && context.user.pfpUrl && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-full text-white min-w-[150px] border-2 border-gray-700">
                <Image
                  src={context.user.pfpUrl}
                  alt="Profile"
                  width={32}
                  height={32}
                  className="rounded-full border-2 border-gray-700"
                  unoptimized
                />
                <span className={`text-base font-semibold ${protoMono.className}`}>{context.user.username}</span>
              </div>
              <button 
                onClick={() => setShowControlPanel(true)}
                className="p-2 hover:bg-gray-800 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Daily Activity Section */}
        <div className="max-w-2xl mx-auto">
          {/* Título - Fila 2 */}
          <h2 className={`text-xl font-bold text-center mb-1 ${protoMono.className}`}>Daily Activity</h2>
          
          {/* Fecha - Fila 3 */}
          <p className="text-gray-400 text-sm mb-6 text-center">{formatDate(new Date())}</p>

          {/* Iconos y Contadores - Fila 4 y 5 */}
          <div className="grid grid-cols-3 gap-8 mb-6">
            {/* Calories */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-gray-700 flex items-center justify-center">
                  <CaloriesIcon className="w-10 h-10" />
                </div>
                <div 
                  className="absolute inset-0 rounded-full border-4" 
                  style={{ 
                    clipPath: `inset(${activity ? 100 - (activity.calories / (goals?.calories_goal || 1) * 100) : 100}% 0 0 0)`,
                    borderColor: activity && activity.calories >= (goals?.calories_goal || 0) ? '#22c55e' : '#f97316'
                  }}
                ></div>
              </div>
              <div className="mt-4 text-center">
                <p className={`text-base font-bold ${protoMono.className}`}>
                  <span className="text-white">{activity?.calories?.toFixed(0) || '0'}</span>
                  <span className="text-gray-500">/{goals?.calories_goal || '-'}</span>
                </p>
                <p className={`text-[10px] text-gray-500 uppercase tracking-wide ${protoMono.className}`}>Calories</p>
              </div>
            </div>

            {/* Steps */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-gray-700 flex items-center justify-center">
                  <StepsIcon className="w-10 h-10" />
                </div>
                <div 
                  className="absolute inset-0 rounded-full border-4" 
                  style={{ 
                    clipPath: `inset(${activity ? 100 - (activity.steps / (goals?.steps_goal || 1) * 100) : 100}% 0 0 0)`,
                    borderColor: activity && activity.steps >= (goals?.steps_goal || 0) ? '#22c55e' : '#f97316'
                  }}
                ></div>
              </div>
              <div className="mt-4 text-center">
                <p className={`text-base font-bold ${protoMono.className}`}>
                  <span className="text-white">{activity?.steps?.toLocaleString() || '0'}</span>
                  <span className="text-gray-500">/{goals?.steps_goal?.toLocaleString() || '-'}</span>
                </p>
                <p className={`text-[10px] text-gray-500 uppercase tracking-wide ${protoMono.className}`}>Steps</p>
              </div>
            </div>

            {/* Sleep */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-gray-700 flex items-center justify-center">
                  <SleepIcon className="w-10 h-10" />
                </div>
                <div 
                  className="absolute inset-0 rounded-full border-4"
                  style={{ 
                    clipPath: `inset(${activity ? 100 - (activity.sleepHours / (goals?.sleep_hours_goal || 1) * 100) : 100}% 0 0 0)`,
                    borderColor: activity && activity.sleepHours >= (goals?.sleep_hours_goal || 0) ? '#22c55e' : '#f97316'
                  }}
                ></div>
              </div>
              <div className="mt-4 text-center">
                <p className={`text-base font-bold ${protoMono.className}`}>
                  <span className="text-white">{activity?.sleepHours?.toFixed(1) || '0'}</span>
                  <span className="text-gray-500">/{goals?.sleep_hours_goal || '-'}h</span>
                </p>
                <p className={`text-[10px] text-gray-500 uppercase tracking-wide ${protoMono.className}`}>Sleep</p>
              </div>
            </div>
          </div>

          {/* Weekly Progress - Fila 6 */}
          <div className="mb-8">
            <div className="text-center mb-6">
              <h2 className={`text-xl font-bold mb-1 ${protoMono.className}`}>Weekly Activity</h2>
              <p className={`text-gray-400 text-sm ${protoMono.className}`}>
                {new Date(weeklyStats[0]?.date || '').toLocaleDateString('en-US', { 
                  month: 'short',
                  day: 'numeric'
                })} - {new Date(weeklyStats[weeklyStats.length - 1]?.date || '').toLocaleDateString('en-US', { 
                  month: 'short',
                  day: 'numeric'
                })}
              </p>
            </div>
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin"></div>
              </div>
            ) : error ? (
              <div className="text-center text-red-500">
                <p>{error}</p>
                <button 
                  onClick={fetchWeeklyData}
                  className="mt-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <>
                {renderProgressBars(
                  "Calories",
                  weeklyStats.map(day => ({ date: day.date, value: day.calories })),
                  goals?.calories_goal || 0,
                  ""
                )}
                {renderProgressBars(
                  "Steps",
                  weeklyStats.map(day => ({ date: day.date, value: day.steps })),
                  goals?.steps_goal || 0,
                  ""
                )}
                {renderProgressBars(
                  "Sleep",
                  weeklyStats.map(day => ({ date: day.date, value: day.sleep })),
                  goals?.sleep_hours_goal || 0,
                  "h"
                )}
              </>
            )}
          </div>

          {/* Cuadro de descripción - Fila 7 (Footer) */}
          <div className="relative border-2 border-gray-800 bg-gray-900 rounded-2xl p-3 w-full overflow-hidden">
            <div className={`relative z-10 text-center space-y-1 ${protoMono.className}`}>
              <div className="flex flex-col gap-0.5">
                <h1 className="text-2xl font-bold">Liv More</h1>
              </div>
              <p className="text-xs leading-relaxed text-gray-300">
                Gamifying wellness by integrating wearable devices, blockchain attestations, and social challenges.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Control Panel Modal */}
      {showControlPanel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1C1F2A] p-8 rounded-3xl w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-2xl font-bold text-white ${protoMono.className}`}>Control Panel</h2>
              <button 
                onClick={() => setShowControlPanel(false)}
                className="p-2 hover:bg-gray-800 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <button
                onClick={() => setShowGoalsModal(true)}
                className={`w-full p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-left ${protoMono.className}`}
              >
                Update Daily Goals
              </button>
              <button
                onClick={() => isConnected ? setIsConnected(false) : setShowConnectModal(true)}
                className={`w-full p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-left ${protoMono.className}`}
              >
                {isConnected ? 'Disconnect Device' : 'Connect Device'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goals Modal */}
      {showGoalsModal && <GoalsModal onSave={handleSaveGoals} />}

      {/* Connect Device Modal */}
      {showConnectModal && (
        <ConnectDeviceModal
          onClose={() => setShowConnectModal(false)}
          onConnect={handleConnectDevice}
          userFid={userFid}
        />
      )}
    </div>
  );
} 