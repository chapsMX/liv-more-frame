'use client';

import React, { useEffect, useState } from 'react';
import { CaloriesIcon, StepsIcon, SleepIcon } from '../styles/svg/index';
import { protoMono } from '../styles/fonts';

interface Goal {
  steps: number;
  calories: number;
  sleep: number;
}

interface Progress {
  steps: number;
  calories: number;
  sleep: number;
}

interface DailyStats {
  date: string;
  steps: number;
  calories: number;
  sleep: number;
}

interface DashboardProps {
  userFid: string;
}

const DEFAULT_GOALS = {
  steps: 10000,
  calories: 2500,
  sleep: 8
};

const Dashboard = ({ userFid }: DashboardProps) => {
  const [goals, setGoals] = useState<Goal>(DEFAULT_GOALS);
  const [progress, setProgress] = useState<Progress>({ steps: 0, calories: 0, sleep: 0 });
  const [weeklyStats, setWeeklyStats] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true);
      setError(null);

      const response = await fetch('/api/auth/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userFid })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Error al desconectar la cuenta');
      }

      // Redirigir al inicio
      window.location.href = '/';
    } catch (error) {
      console.error('Error al desconectar:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setDisconnecting(false);
    }
  };

  useEffect(() => {
    fetchUserData();
    const interval = setInterval(fetchUserData, 300000); // Actualizar cada 5 minutos
    return () => clearInterval(interval);
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Obteniendo datos para userFid:', userFid);

      // Obtener objetivos del usuario
      const goalsResponse = await fetch('/api/goals/get', {
        headers: {
          'x-user-fid': userFid
        }
      });
      const goalsData = await goalsResponse.json();
      console.log('Respuesta de objetivos:', goalsData);

      if (!goalsData.success) {
        throw new Error(goalsData.error || 'Error al obtener objetivos');
      }

      setGoals(goalsData.data);

      // Obtener datos diarios
      const dailyResponse = await fetch('/api/fitness/daily-stats', {
        headers: {
          'x-user-fid': userFid
        }
      });
      const dailyData = await dailyResponse.json();
      console.log('Respuesta de datos diarios:', dailyData);

      if (!dailyData.success) {
        throw new Error(dailyData.error || 'Error al obtener datos diarios');
      }

      setProgress(dailyData.data);

      // Obtener datos semanales
      const weeklyResponse = await fetch('/api/fitness/weekly-stats', {
        headers: {
          'x-user-fid': userFid
        }
      });
      const weeklyData = await weeklyResponse.json();
      console.log('Respuesta de datos semanales:', weeklyData);

      if (!weeklyData.success) {
        throw new Error(weeklyData.error || 'Error al obtener datos semanales');
      }

      setWeeklyStats(weeklyData.data);

    } catch (error) {
      console.error('Error al obtener datos:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const calculatePercentage = (current: number, goal: number) => {
    return Math.min((current / goal) * 100, 100);
  };

  const renderMetricCard = (
    Icon: React.ComponentType<{ className?: string }>,
    title: string,
    current: number,
    goal: number,
    unit: string
  ) => {
    const percentage = calculatePercentage(current, goal);
    const isComplete = percentage >= 100;
    
    return (
      <div className="flex flex-col items-center">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-gray-700 flex items-center justify-center">
            <Icon className="w-10 h-10" />
          </div>
          <div 
            className={`absolute inset-0 rounded-full border-4 ${isComplete ? 'border-green-500' : 'border-red-500'}`} 
            style={{ clipPath: isComplete ? 'none' : `inset(${100 - percentage}% 0 0 0)` }}
          />
        </div>
        <div className="mt-4 text-center">
          <p className={`text-base font-bold ${protoMono.className}`}>
            <span className="text-white">{current.toLocaleString()}</span>
            <span className="text-gray-500">/{goal.toLocaleString()}</span>
          </p>
          <p className={`text-[10px] text-gray-500 uppercase tracking-wide ${protoMono.className}`}>{title}</p>
        </div>
      </div>
    );
  };

  const renderProgressBars = (
    title: string,
    data: { date: string; value: number }[],
    goal: number,
    unit: string
  ) => {
    return (
      <div className="mb-12">
        <h3 className={`text-xl font-bold mb-4 ${protoMono.className}`}>{title}</h3>
        <div className="grid grid-cols-7 gap-2">
          {/* Days of week */}
          {data.map((day, index) => (
            <div key={`day-${index}`} className={`text-center ${protoMono.className}`}>
              <div className="text-gray-500 text-sm mb-1">
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
                <div className="h-32 w-full relative flex items-end">
                  <div 
                    className={`w-full rounded-t-sm transition-all ${isComplete ? 'bg-green-500' : 'bg-violet-500'}`}
                    style={{ height: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                <div className={`text-xs mt-2 ${protoMono.className} text-gray-400`}>
                  {day.value.toLocaleString()}{unit}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin"></div>
          <p className={protoMono.className}>Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-red-500">Error: {error}</p>
          <button 
            onClick={fetchUserData}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black text-white font-mono flex flex-col">
      <div className="w-full h-full p-6 flex flex-col">
        {/* Header */}
{/*         <div className="text-center mb-8">
          <h1 className={`text-4xl font-bold mb-4 ${protoMono.className}`}>Liv More</h1>
          <p className={`text-lg text-gray-300 max-w-3xl mx-auto ${protoMono.className}`}>
            Gamifying wellness by integrating wearable devices, blockchain attestations, and social challenges.
          </p>
        </div> */}

        {/* Daily Goals with Icons */}
        <div className="mb-12">
          <h1 className={`text-2xl font-bold mb-2 text-center ${protoMono.className}`}>Daily Goals</h1>
          <p className={`text-gray-400 text-center mb-8 ${protoMono.className}`}>
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
          <div className="grid grid-cols-3 gap-8 w-full">
            {renderMetricCard(
              CaloriesIcon,
              "Calories",
              progress.calories,
              goals.calories,
              "kcal"
            )}
            {renderMetricCard(
              StepsIcon,
              "Steps",
              progress.steps,
              goals.steps,
              "steps"
            )}
            {renderMetricCard(
              SleepIcon,
              "Sleep",
              progress.sleep,
              goals.sleep,
              "hours"
            )}
          </div>
        </div>

        {/* Weekly Progress Bars */}
        <div className="flex-1">
          {renderProgressBars(
            "Calories",
            weeklyStats.map(day => ({ date: day.date, value: day.calories })),
            goals.calories,
            "cal"
          )}
          {renderProgressBars(
            "Steps",
            weeklyStats.map(day => ({ date: day.date, value: day.steps })),
            goals.steps,
            ""
          )}
          {renderProgressBars(
            "Sleep",
            weeklyStats.map(day => ({ date: day.date, value: day.sleep })),
            goals.sleep,
            "h"
          )}
        </div>

        {/* Disconnect Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className={`px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-sm ${protoMono.className}`}
          >
            {disconnecting ? 'Disconnecting...' : 'Disconnect Google Fit'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 