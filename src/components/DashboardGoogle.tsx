"use client";

import { useEffect, useState, useCallback } from "react";
import { protoMono } from '../styles/fonts';
import { CaloriesIcon, StepsIcon, SleepIcon } from '../styles/svg/index';
import GoalsModal from './GoalsModal';
import ConnectDeviceModal from './ConnectDeviceModal';
import Loader from './Loader';
import sdk, { type Context } from "@farcaster/frame-sdk";

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

export default function DashboardGoogle() {
  const [isTransitioning, setIsTransitioning] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [context, setContext] = useState<Context.FrameContext>();
  const [hasGoals, setHasGoals] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState<string | null>(null);

  const checkUserGoals = useCallback(async () => {
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
  }, [userFid]);

  const checkUserConnection = useCallback(async () => {
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
  }, [userFid, hasGoals]);

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

  const fetchActivityData = useCallback(async () => {
    try {
      if (!userFid) {
        console.log('No hay userFid disponible para fetchActivityData');
        return;
      }

      console.log('Iniciando fetchActivityData para userFid:', userFid);
      
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await fetch(`/api/fitness/activity?user_fid=${userFid}&timezone=${encodeURIComponent(userTimezone)}`);
      
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
  }, [userFid]);

  const renderProgressBars = (
    title: string,
    data: { date: string; value: number }[],
    goal: number,
    unit: string
  ) => {
    return (
      <div className="mb-2">
        <h3 className={`text-lg font-bold mb-2 ${protoMono.className}`}>{title}</h3>
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

  const fetchWeeklyData = useCallback(async () => {
    try {
      if (!userFid) {
        console.log('No hay userFid disponible para fetchWeeklyData');
        return;
      }

      console.log('Iniciando fetchWeeklyData para userFid:', userFid);
      
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await fetch(`/api/fitness/weekly?user_fid=${userFid}&timezone=${encodeURIComponent(userTimezone)}`);
      
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
  }, [userFid]);

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
  }, [userFid, checkUserGoals, checkUserConnection, fetchActivityData, fetchWeeklyData]);

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
  }, [userFid, fetchActivityData, fetchWeeklyData]);

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
    <div className="w-full max-w-2xl mx-auto">
      {/* Daily Activity */}
      <div className="mb-2">
        <h2 className={`text-2xl font-bold text-center mb-2 ${protoMono.className}`}>
          Daily Activity
        </h2>
        <h2 className={`text-sm text-center font-bold mb-2 ${protoMono.className}`}>
          {activity ? formatDate(new Date()) : 'Daily Activity'}
        </h2>
        
        <div className="grid grid-cols-3 gap-8">
          {/* Calories */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-gray-700 flex items-center justify-center bg-gray-900">
                <CaloriesIcon className="w-12 h-12 text-white" />
              </div>
              <div 
                className="absolute inset-0 rounded-full border-4 border-violet-500" 
                style={{ 
                  clipPath: `inset(${100 - ((activity?.calories || 0) / (goals?.calories_goal || 1)) * 100}% 0 0 0)` 
                }}
              ></div>
            </div>
            <div className="mt-4 text-center">
              <p className="text-lg font-bold">
                <span className="text-white">{activity?.calories || 0}</span>
                <span className="text-gray-500">/{goals?.calories_goal || '---'}</span>
              </p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Calories</p>
            </div>
          </div>

          {/* Steps */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-gray-700 flex items-center justify-center bg-gray-900">
                <StepsIcon className="w-12 h-12 text-white" />
              </div>
              <div 
                className="absolute inset-0 rounded-full border-4 border-violet-500" 
                style={{ 
                  clipPath: `inset(${100 - ((activity?.steps || 0) / (goals?.steps_goal || 1)) * 100}% 0 0 0)` 
                }}
              ></div>
            </div>
            <div className="mt-4 text-center">
              <p className="text-lg font-bold">
                <span className="text-white">{activity?.steps || 0}</span>
                <span className="text-gray-500">/{goals?.steps_goal || '---'}</span>
              </p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Steps</p>
            </div>
          </div>

          {/* Sleep */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-gray-700 flex items-center justify-center bg-gray-900">
                <SleepIcon className="w-12 h-12 text-white" />
              </div>
              <div 
                className="absolute inset-0 rounded-full border-4 border-violet-500" 
                style={{ 
                  clipPath: `inset(${100 - ((activity?.sleepHours || 0) / (goals?.sleep_hours_goal || 1)) * 100}% 0 0 0)` 
                }}
              ></div>
            </div>
            <div className="mt-4 text-center">
              <p className="text-lg font-bold">
                <span className="text-white">{activity?.sleepHours || 0}</span>
                <span className="text-gray-500">h/{goals?.sleep_hours_goal || '---'}h</span>
              </p>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Sleep</p>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Activity */}
      <div>
        <h2 className={`text-2xl text-center font-bold mb-4 ${protoMono.className}`}>Weekly Activity</h2>
        {weeklyStats.length > 0 ? (
          <>
            {renderProgressBars(
              'Calories',
              weeklyStats.map(day => ({ date: day.date, value: day.calories })),
              goals?.calories_goal || 2500,
              'cal'
            )}
            {renderProgressBars(
              'Steps',
              weeklyStats.map(day => ({ date: day.date, value: day.steps })),
              goals?.steps_goal || 10000,
              'steps'
            )}
            {renderProgressBars(
              'Sleep',
              weeklyStats.map(day => ({ date: day.date, value: day.sleep })),
              goals?.sleep_hours_goal || 8,
              'h'
            )}
          </>
        ) : (
          <div className="text-center text-gray-500">No weekly data available</div>
        )}
      </div>

      {/* Modals */}
      {showGoalsModal && (
        <GoalsModal
          onSave={handleSaveGoals}
        />
      )}
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