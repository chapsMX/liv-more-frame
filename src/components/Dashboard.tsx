'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';

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

  useEffect(() => {
    fetchUserData();
    const interval = setInterval(fetchUserData, 300000); // Actualizar cada 5 minutos
    return () => clearInterval(interval);
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener objetivos del usuario
      const goalsResponse = await fetch('/api/goals/get', {
        headers: {
          'x-user-fid': userFid
        }
      });
      const goalsData = await goalsResponse.json();

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

  const renderProgressBar = (current: number, goal: number) => {
    const percentage = calculatePercentage(current, goal);
    return (
      <div className="w-full h-2 bg-gray-200 rounded-full">
        <div 
          className="h-full bg-green-500 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  };

  const renderMetricCard = (
    iconPath: string,
    title: string,
    current: number,
    goal: number,
    unit: string
  ) => (
    <button 
      className={`p-4 rounded-lg shadow-lg ${
        calculatePercentage(current, goal) >= 100 
          ? 'bg-green-100 hover:bg-green-200' 
          : 'bg-white hover:bg-gray-50'
      } transition-all duration-300`}
      onClick={() => {
        if (calculatePercentage(current, goal) >= 100) {
          // TODO: Implementar mint de atestación
          console.log('Mint attestation for:', title);
        }
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="w-8 h-8 relative">
          <Image
            src={iconPath}
            alt={title}
            fill
            className="object-contain"
          />
        </div>
        <div className="text-sm font-medium text-gray-500">{title}</div>
      </div>
      <div className="text-2xl font-bold mb-2">
        {current.toLocaleString()} / {goal.toLocaleString()} {unit}
      </div>
      {renderProgressBar(current, goal)}
    </button>
  );

  const renderWeeklyStats = () => (
    <div className="mt-8">
      <h3 className="text-lg font-semibold mb-4">Histórico Semanal</h3>
      <div className="grid grid-cols-7 gap-2">
        {weeklyStats.map((day, index) => (
          <div key={index} className="text-center">
            <div className="text-sm text-gray-500">
              {new Date(day.date).toLocaleDateString('es-ES', { weekday: 'short' })}
            </div>
            <div className="mt-2 space-y-2">
              <div className="text-sm">{day.steps.toLocaleString()}</div>
              <div className="text-sm">{day.calories.toLocaleString()}</div>
              <div className="text-sm">{day.sleep.toFixed(1)}h</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        <p className="text-lg font-semibold">Error</p>
        <p className="text-sm">{error}</p>
        <button 
          onClick={fetchUserData}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <main className="max-w-4xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6">Tu Progreso Diario</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderMetricCard(
            "/icons/steps.svg",
            "Pasos",
            progress.steps,
            goals.steps,
            "pasos"
          )}
          {renderMetricCard(
            "/icons/calories.svg",
            "Calorías",
            progress.calories,
            goals.calories,
            "kcal"
          )}
          {renderMetricCard(
            "/icons/sleep.svg",
            "Sueño",
            progress.sleep,
            goals.sleep,
            "horas"
          )}
        </div>
        {renderWeeklyStats()}
      </main>

      <footer className="w-full overflow-hidden py-2 mb-2">
        <div className="relative flex flex-col gap-0.5">
          <p className="text-center text-gray-400 text-sm">
            made with <span className="text-red-500 text-lg">❤</span> during ETH Denver
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard; 