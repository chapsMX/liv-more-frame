"use client";

import { useState, useEffect } from 'react';
import { protoMono } from '../styles/fonts';
import { CaloriesIcon, StepsIcon, SleepIcon } from '../styles/svg/index';

export interface RookActivityData {
  user: {
    username: string;
    display_name: string;
  } | null;
  date: string;
  physical: {
    steps: number;
    calories: number;
  };
  sleep: {
    hours: number;
    efficiency: number;
  };
}

interface DailyActivityProps {
  userFid: string;
  date?: string;
  onDataLoaded?: (data: RookActivityData | null) => void;
}

interface ActivityGoals {
  steps_goal: number;
  calories_goal: number;
  sleep_hours_goal: number;
}

interface ActivityData {
  steps: number;
  calories: number;
  sleep_hours: number;
}

export default function DailyActivity({ userFid, date, onDataLoaded }: DailyActivityProps) {
  const [goals, setGoals] = useState<ActivityGoals>({
    steps_goal: 7500,
    calories_goal: 350,
    sleep_hours_goal: 7.0
  });
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [rookData, setRookData] = useState<RookActivityData | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const fetchActivityData = async () => {
    if (!userFid || isFetching) return;
    
    setIsFetching(true);
    setLoading(true);
    setHasData(false);
    
    try {
      // Obtener las metas del usuario
      console.log(`Fetching goals for user_fid: ${userFid}`);
      const goalsResponse = await fetch(`/api/goals/get?user_fid=${userFid}`);
      const goalsData = await goalsResponse.json();
      
      if (goalsData.success) {
        setGoals(goalsData.goals);
      }
      
      // Obtener los datos de actividad del día
      const dateParam = date ? `&date=${date}` : '';
      const timestamp = Date.now();
      console.log(`Fetching activity data for user_fid: ${userFid}${dateParam}`);
      const activityResponse = await fetch(`/api/rook/dashboard-data?user_fid=${userFid}${dateParam}&_t=${timestamp}`);
      const activityResult = await activityResponse.json();
      
      if (activityResult.success && activityResult.data) {
        const data = activityResult.data;
        setRookData(data);
        setLastFetched(new Date());
        
        // Notificar al componente padre que se han cargado datos
        if (onDataLoaded) {
          onDataLoaded(data);
        }
        
        setActivity({
          steps: data.physical?.steps || 0,
          calories: data.physical?.calories || 0,
          sleep_hours: data.sleep?.hours || 0
        });
        setHasData(true);
        
        console.log(`Activity data loaded: steps=${data.physical?.steps}, calories=${data.physical?.calories}, sleep=${data.sleep?.hours}`);
      } else {
        console.log('No hay datos disponibles:', activityResult.error);
        setActivity(null);
        setRookData(null);
        
        // Notificar al componente padre que no hay datos
        if (onDataLoaded) {
          onDataLoaded(null);
        }
      }
    } catch (err) {
      console.error('Error fetching activity data:', err);
      setActivity(null);
      setRookData(null);
      
      // Notificar al componente padre que ha habido un error
      if (onDataLoaded) {
        onDataLoaded(null);
      }
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    async function fetchData() {
      if (!isMounted) return;
      await fetchActivityData();
    }
    
    fetchData();
    
    // Limpieza al desmontar el componente
    return () => {
      isMounted = false;
    };
  }, [userFid, date]);

  if (loading) {
    return (
      <div className="text-center p-4 bg-gray-900 border border-gray-800 rounded-lg mb-4">
        <div className="animate-pulse">Cargando actividad diaria...</div>
      </div>
    );
  }

  if (!hasData || !activity) {
    return (
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg shadow-lg mb-6">
        <h2 className={`text-xl font-bold mb-4 ${protoMono.className}`}>
        Daily Progress Tracker
        </h2>
        <div className="text-center py-4">
          <p className="text-gray-400">Sin datos de actividad para mostrar</p>
          <button 
            onClick={() => window.location.href = `/api/rook/connect?user_fid=${userFid}`}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Conectar con Rook
          </button>
        </div>
      </div>
    );
  }

  // Asegurarnos de que todos los valores son números válidos
  const steps = typeof activity.steps === 'number' ? activity.steps : 0;
  const calories = typeof activity.calories === 'number' ? activity.calories : 0;
  const sleepHours = typeof activity.sleep_hours === 'number' ? activity.sleep_hours : 0;
  
  // Calcular porcentajes de progreso de forma segura
  const stepsPercentage = Math.min(100, Math.round((steps / (goals.steps_goal || 1)) * 100));
  const caloriesPercentage = Math.min(100, Math.round((calories / (goals.calories_goal || 1)) * 100));
  const sleepPercentage = Math.min(100, Math.round((sleepHours / (goals.sleep_hours_goal || 1)) * 100));
  
  // Calcular el progreso general (promedio de los tres porcentajes)
  const overallProgress = calculateOverallProgress(stepsPercentage, caloriesPercentage, sleepPercentage);
  
  // Determinar el mensaje según el progreso general
  const progressMessage = getProgressMessage(overallProgress);
  
  // Determinar el color del progreso
  const progressColor = getProgressColor(overallProgress);

  const today = date || new Date().toISOString().split('T')[0];
  
  return (
    <div className="space-y-4">
      {/* Resumen del progreso diario */}
      <div className={`p-2 bg-gray-900 border border-gray-800 rounded-lg shadow-lg text-center`}>
        <h2 className={`text-xl font-bold mb-3 ${protoMono.className}`}>
         Daily Activity
        </h2>
        
        <div className="flex flex-col items-center justify-center mb-4">
          <div className={`w-28 h-28 rounded-full flex items-center justify-center border-4 ${progressColor.border}`}>
            <div className="text-center">
              <span className={`text-4xl ${protoMono.className} font-bold ${progressColor.text}`}>{overallProgress}%</span>
            </div>
          </div>
        </div>
        
        <p className={`text-lg ${progressColor.text} ${protoMono.className} font-semibold mb-1`}>{progressMessage}</p>
        
        <p className={`text-red-500 text-xs ${protoMono.className}`}>
          {rookData?.sleep.efficiency ? 
            `Sleep Efficiency: ${Math.round(rookData.sleep.efficiency * 100)}%` : 
            'Gathering your data,hang tight!'}
        </p>
      </div>
      
      {/* Actividad Diaria con detalles */}
      <div className="p-2 bg-gray-900 border border-gray-800 rounded-lg shadow-lg mb-4">
        <h2 className={`text-xl font-bold mb-2 text-center ${protoMono.className}`}>
          Daily Activity <br /> {today}
        </h2>
        
        <div className="space-y-4">
          {/* Pasos */}
          <div>
            <div className="flex justify-between mb-1">
              <span className={`text-sm font-medium text-blue-400 ${protoMono.className}`}>Steps</span>
              <span className={`text-sm font-medium text-blue-400 ${protoMono.className}`}>
                {steps.toLocaleString()} / {goals.steps_goal.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div 
                className="bg-blue-500 h-2.5 rounded-full"
                style={{ width: `${stepsPercentage}%` }}
              ></div>
            </div>
            <div className="text-right text-xs text-gray-400 mt-1">
              {stepsPercentage}% completed
            </div>
          </div>
          
          {/* Calorías */}
          <div>
            <div className="flex justify-between mb-1">
              <span className={`text-sm font-medium text-orange-400 ${protoMono.className}`}>Calories</span>
              <span className={`text-sm font-medium text-orange-400 ${protoMono.className}`}>
                {calories.toLocaleString()} / {goals.calories_goal.toLocaleString()} kcal
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div 
                className="bg-orange-500 h-2.5 rounded-full"
                style={{ width: `${caloriesPercentage}%` }}
              ></div>
            </div>
            <div className="text-right text-xs text-gray-400 mt-1">
              {caloriesPercentage}% completed
            </div>
          </div>
          
          {/* Horas de sueño */}
          <div>
            <div className="flex justify-between mb-1">
              <span className={`text-sm font-medium text-indigo-400 ${protoMono.className}`}>Sleep Hours</span>
              <span className={`text-sm font-medium text-indigo-400 ${protoMono.className}`}>
                {sleepHours.toFixed(1)} / {goals.sleep_hours_goal.toFixed(1)} hrs
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div 
                className="bg-indigo-500 h-2.5 rounded-full"
                style={{ width: `${sleepPercentage}%` }}
              ></div>
            </div>
            <div className="text-right text-xs text-gray-400 mt-1">
              {sleepPercentage}% completed
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex justify-between items-center">
          <div className="text-xs text-gray-400">
            {lastFetched && `Last update: ${lastFetched.toLocaleTimeString()}`}
          </div>
          <div className="flex gap-2">
            <button 
              onClick={fetchActivityData}
              className="px-3 py-1 bg-gray-700 text-white text-sm rounded hover:bg-gray-600 transition-colors"
            >
              Refresh
            </button>
            <button 
              onClick={() => window.location.href = `/api/rook/connect?user_fid=${userFid}`}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              Sync
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Función para calcular el progreso general promediando los tres porcentajes
function calculateOverallProgress(steps: number, calories: number, sleep: number): number {
  return Math.round((steps + calories + sleep) / 3);
}

// Función para obtener un mensaje según el progreso
function getProgressMessage(progress: number): string {
  if (progress < 20) {
    return "Let’s get things rolling!";
  } else if (progress < 40) {
    return "You're warming up nicely!";
  } else if (progress < 60) {
    return "Solid pace—keep it up!";
  } else if (progress < 80) {
    return "You're crushing it today!";
  } else {
    return "What a day—amazing job!";
  }
}

// Función para obtener colores según el progreso
function getProgressColor(progress: number): { border: string, text: string } {
  if (progress < 30) {
    return { border: "border-blue-500", text: "text-blue-400" };
  } else if (progress < 60) {
    return { border: "border-indigo-500", text: "text-indigo-400" };
  } else if (progress < 80) {
    return { border: "border-purple-500", text: "text-purple-400" };
  } else {
    return { border: "border-green-500", text: "text-green-400" };
  }
} 