"use client";

import { useState, useEffect } from 'react';
import { protoMono } from '../styles/fonts';

interface WeeklyStatsProps {
  userFid: string;
}

interface DailyData {
  date: string;
  steps: number;
  calories: number;
  sleep_hours: number;
}

interface UserGoals {
  steps_goal: number;
  calories_goal: number;
  sleep_hours_goal: number;
}

export default function WeeklyStats({ userFid }: WeeklyStatsProps) {
  const [weeklyData, setWeeklyData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [goals, setGoals] = useState<UserGoals>({
    steps_goal: 7500,    // valores por defecto mientras se cargan los reales
    calories_goal: 350,
    sleep_hours_goal: 7.0
  });
  
  // Función para formatear fechas en un formato corto
  const formatDay = (dateStr: string) => {
    const date = new Date(dateStr);
    // Abreviatura de día de la semana
    const day = new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date);
    // Día del mes
    const dayNum = date.getDate();
    return `${day} ${dayNum}`;
  };

  // Función para obtener los datos semanales de la API
  const fetchWeeklyData = async () => {
    if (!userFid) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Calcular fecha de hace 7 días
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      console.log(`Fetching weekly data for user_fid: ${userFid} from ${startDate} to ${endDate}`);
      const response = await fetch(`/api/rook/weekly-data?user_fid=${userFid}&start_date=${startDate}&end_date=${endDate}`);
      
      if (!response.ok) {
        throw new Error(`Error al obtener datos semanales: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data && Array.isArray(data.data)) {
        console.log('Weekly data loaded:', data.data);
        setWeeklyData(data.data);
      } else {
        console.log('No weekly data available:', data.error || 'Unknown error');
        setWeeklyData([]);
        setError('No hay datos disponibles para mostrar');
      }
    } catch (err) {
      console.error('Error fetching weekly data:', err);
      setError('Error al cargar los datos semanales');
      setWeeklyData([]);
    } finally {
      setLoading(false);
    }
  };

  // Función para obtener los objetivos del usuario
  const fetchUserGoals = async () => {
    if (!userFid) return;
    
    try {
      const response = await fetch(`/api/goals/get?user_fid=${userFid}`);
      if (!response.ok) {
        throw new Error(`Error al obtener objetivos: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success && data.goals) {
        setGoals({
          steps_goal: data.goals.steps_goal,
          calories_goal: data.goals.calories_goal,
          sleep_hours_goal: data.goals.sleep_hours_goal
        });
      }
    } catch (err) {
      console.error('Error fetching user goals:', err);
      // Mantenemos los valores por defecto si hay error
    }
  };

  // Modificamos useEffect para cargar tanto los datos semanales como los objetivos
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchWeeklyData(),
        fetchUserGoals()
      ]);
      setLoading(false);
    };
    
    loadData();
  }, [userFid]);

  // Calcular la altura de la barra basada en el valor real
  const getBarHeight = (value: number, maxValue: number) => {
    if (maxValue === 0) return 0;
    // Calculamos la altura como porcentaje del contenedor
    return Math.max((value / maxValue) * 100, 1);
  };

  // Determinar el color de la barra según si alcanzó el objetivo
  const getBarColor = (value: number, goal: number) => {
    return value >= goal ? 'bg-green-500' : '';
  };

  if (loading) {
    return (
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg shadow-lg mb-6">
        <h2 className={`text-xl font-bold mb-4 ${protoMono.className}`}>
         Daily Activity
        </h2>
        <div className="text-center py-4">
          <div className="animate-pulse">Cargando datos semanales...</div>
        </div>
      </div>
    );
  }

  if (error && weeklyData.length === 0) {
    return (
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg shadow-lg mb-6">
        <h2 className={`text-xl font-bold text-center mb-4 ${protoMono.className}`}>
          Weekly Activity
        </h2>
        <div className="text-center py-4">
          <p className="text-red-400 mb-2">{error}</p>
          <button 
            onClick={fetchWeeklyData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className={`text-xl text-center font-bold mb-2 ${protoMono.className}`}>
        Weekly Activity
      </h2>
      <p className={`text-sm text-center text-gray-400 -mt-3 mb-5 ${protoMono.className}`}>
        {weeklyData.length > 0 
          ? `${formatDay(weeklyData[0].date)} - ${formatDay(weeklyData[weeklyData.length - 1].date)}`
          : 'No data available'
        }
      </p>
      {/* Pasos */}
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg shadow-lg">
        <h3 className={`text-lg font-semibold mb-3 text-blue-400 ${protoMono.className}`}>
          Steps (Goal: {goals.steps_goal.toLocaleString()})
        </h3>
        <div className="h-[160px] flex items-end justify-between px-2">
          {weeklyData.map((day, index) => {
            const maxSteps = Math.max(...weeklyData.map(d => d.steps));
            const barHeight = getBarHeight(day.steps, maxSteps);
            const barColorClass = getBarColor(day.steps, goals.steps_goal);
            
            return (
              <div key={`steps-${index}`} className="flex flex-col items-center w-1/8">
                <div className="h-[120px] relative w-12 flex items-end justify-center">
                  <div 
                    className={`${barColorClass || 'bg-blue-500'} w-8 rounded-t-lg transition-all`}
                    style={{ height: `${barHeight}%` }}
                  />
                </div>
                <span className="text-xs text-white-400 mt-2">{formatDay(day.date)}</span>
                <span className="text-xs text-white-400 text-center">{day.steps.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Calorías */}
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg shadow-lg">
        <h3 className={`text-lg font-semibold mb-5 text-orange-400 ${protoMono.className}`}>
          Calories (Goal: {goals.calories_goal.toLocaleString()})
        </h3>
        <div className="h-[160px] flex items-end justify-between px-2">
          {weeklyData.map((day, index) => {
            const maxCalories = Math.max(...weeklyData.map(d => d.calories));
            const barHeight = getBarHeight(day.calories, maxCalories);
            const barColorClass = getBarColor(day.calories, goals.calories_goal);
            
            return (
              <div key={`calories-${index}`} className="flex flex-col items-center w-1/8">
                <div className="h-[120px] relative w-12 flex items-end justify-center">
                  <div 
                    className={`${barColorClass || 'bg-orange-500'} w-8 rounded-t-lg transition-all`}
                    style={{ height: `${barHeight}%` }}
                  />
                </div>
                <span className="text-xs text-white-400 mt-2">{formatDay(day.date)}</span>
                <span className="text-xs text-white-400 text-center">{day.calories.toLocaleString()} kcal</span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Sueño */}
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg shadow-lg">
        <h3 className={`text-lg font-semibold mb-3 text-indigo-400 ${protoMono.className}`}>
          Sleep (Goal: {goals.sleep_hours_goal.toFixed(1)}h)
        </h3>
        <div className="h-[160px] flex items-end justify-between px-2">
          {weeklyData.map((day, index) => {
            const maxSleep = Math.max(...weeklyData.map(d => d.sleep_hours));
            const barHeight = getBarHeight(day.sleep_hours, maxSleep);
            const barColorClass = getBarColor(day.sleep_hours, goals.sleep_hours_goal);
            
            return (
              <div key={`sleep-${index}`} className="flex flex-col items-center w-1/8">
                <div className="h-[120px] relative w-12 flex items-end justify-center">
                  <div 
                    className={`${barColorClass || 'bg-indigo-500'} w-8 rounded-t-lg transition-all`}
                    style={{ height: `${barHeight}%` }}
                  />
                </div>
                <span className="text-xs text-white-400 mt-2">{formatDay(day.date)}</span>
                <span className="text-xs text-white-400 text-center">{day.sleep_hours.toFixed(1)}h</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-right">
        <button 
          onClick={fetchWeeklyData}
          className="px-3 py-1 bg-gray-700 text-white text-sm rounded hover:bg-gray-600 transition-colors"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
} 