'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { protoMono } from '@/styles/fonts';

interface ActivityData {
  date: string;
  steps: number;
  sleep_hours: number;
  calories: number;
}

// Datos mockup para pruebas
const mockActivityData: ActivityData[] = [
  {
    date: '2023-10-20',
    steps: 8521,
    sleep_hours: 7.2,
    calories: 420
  },
  {
    date: '2023-10-19',
    steps: 10352,
    sleep_hours: 6.8,
    calories: 510
  },
  {
    date: '2023-10-18',
    steps: 6890,
    sleep_hours: 8.1,
    calories: 380
  },
  {
    date: '2023-10-17',
    steps: 9120,
    sleep_hours: 7.5,
    calories: 450
  },
  {
    date: '2023-10-16',
    steps: 7450,
    sleep_hours: 6.9,
    calories: 410
  },
  {
    date: '2023-10-15',
    steps: 11230,
    sleep_hours: 7.8,
    calories: 540
  },
  {
    date: '2023-10-14',
    steps: 8760,
    sleep_hours: 8.2,
    calories: 430
  }
];

export default function RookDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [userFid, setUserFid] = useState<string | null>(null);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncDate, setLastSyncDate] = useState<string | null>(null);

  useEffect(() => {
    // Obtener el usuario actual desde localStorage (simulación)
    const storedUserFid = localStorage.getItem('currentUserFid');
    if (storedUserFid) {
      setUserFid(storedUserFid);
      fetchActivityData(storedUserFid);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchActivityData = async (userFid: string) => {
    try {
      // En producción, aquí harías una llamada a tu API para obtener los datos de actividad
      // const response = await fetch(`/api/rook/data?user_fid=${userFid}`);
      // const data = await response.json();
      
      // Por ahora, simulamos un pequeño retraso y usamos datos mock
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setActivityData(mockActivityData);
      setLastSyncDate(new Date().toISOString());
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching activity data:', err);
      setError('Error al cargar los datos de actividad. Por favor, intenta nuevamente.');
      setIsLoading(false);
    }
  };
  
  const calculateAverages = () => {
    if (activityData.length === 0) return { avgSteps: 0, avgSleep: 0, avgCalories: 0 };
    
    const totalSteps = activityData.reduce((sum, day) => sum + day.steps, 0);
    const totalSleep = activityData.reduce((sum, day) => sum + day.sleep_hours, 0);
    const totalCalories = activityData.reduce((sum, day) => sum + day.calories, 0);
    
    return {
      avgSteps: Math.round(totalSteps / activityData.length),
      avgSleep: parseFloat((totalSleep / activityData.length).toFixed(1)),
      avgCalories: Math.round(totalCalories / activityData.length)
    };
  };
  
  const averages = calculateAverages();

  // Función para sincronizar datos manualmente
  const handleSyncData = async () => {
    if (!userFid) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // En producción, aquí harías una llamada a tu API para sincronizar datos
      console.log(`Sincronizando datos para el usuario ${userFid}`);
      
      // Simular una sincronización
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Actualizamos los datos con valores aleatorios para simular nuevos datos
      const newData = [...mockActivityData];
      // Añadimos un nuevo día con datos aleatorios
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      const randomSteps = 6000 + Math.floor(Math.random() * 6000);
      const randomSleep = 6 + (Math.random() * 3);
      const randomCalories = 350 + Math.floor(Math.random() * 250);
      
      newData.unshift({
        date: todayStr,
        steps: randomSteps,
        sleep_hours: parseFloat(randomSleep.toFixed(1)),
        calories: randomCalories
      });
      
      setActivityData(newData);
      setLastSyncDate(new Date().toISOString());
      setIsLoading(false);
    } catch (err) {
      console.error('Error syncing data:', err);
      setError('Error al sincronizar los datos. Por favor, intenta nuevamente.');
      setIsLoading(false);
    }
  };

  if (!userFid && !isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-900 text-white">
        <header className="p-4 bg-gray-800 border-b border-gray-700">
          <div className="container mx-auto">
            <h1 className={`text-2xl font-bold text-orange-500 ${protoMono.className}`}>
              Rook - Dashboard
            </h1>
          </div>
        </header>

        <main className="flex-grow container mx-auto p-6">
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-yellow-500 mb-4">
              No hay usuario seleccionado
            </h2>
            <p className="mb-6">
              Para visualizar datos de actividad, debes seleccionar un usuario de prueba.
            </p>
            <Link 
              href="/rook-test"
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-md text-sm transition-colors"
            >
              Volver e iniciar sesión
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <header className="p-4 bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto">
          <div className="flex justify-between items-center">
            <h1 className={`text-2xl font-bold text-orange-500 ${protoMono.className}`}>
              Rook - Dashboard
            </h1>
            <Link
              href="/rook-test"
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-6">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
                <p className="text-red-400">{error}</p>
              </div>
            )}
            
            <div className="bg-gray-800 rounded-lg p-6 shadow-md mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className={`text-xl font-semibold ${protoMono.className}`}>
                  Datos de actividad
                </h2>
                <button 
                  onClick={handleSyncData}
                  disabled={isLoading}
                  className={`px-4 py-2 rounded-md text-sm transition-colors ${
                    isLoading 
                      ? 'bg-orange-900/50 text-gray-300 cursor-wait' 
                      : 'bg-orange-600 hover:bg-orange-500'
                  }`}
                >
                  {isLoading ? 'Sincronizando...' : 'Sincronizar datos'}
                </button>
              </div>
              
              {userFid && (
                <p className="mb-2 text-sm text-gray-400">
                  Usuario: <span className="text-orange-400">{userFid}</span>
                </p>
              )}
              
              {lastSyncDate && (
                <p className="mb-4 text-xs text-gray-400">
                  Última sincronización: {new Date(lastSyncDate).toLocaleString()}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-800 rounded-lg p-6 shadow-md">
                <div className="flex items-center mb-4">
                  <span className="text-2xl mr-3">👣</span>
                  <h3 className={`text-lg font-semibold ${protoMono.className}`}>Pasos</h3>
                </div>
                <div className="text-3xl font-bold text-orange-400 mb-2">
                  {averages.avgSteps.toLocaleString()}
                </div>
                <p className="text-sm text-gray-400">
                  Promedio diario
                </p>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-6 shadow-md">
                <div className="flex items-center mb-4">
                  <span className="text-2xl mr-3">😴</span>
                  <h3 className={`text-lg font-semibold ${protoMono.className}`}>Sueño</h3>
                </div>
                <div className="text-3xl font-bold text-orange-400 mb-2">
                  {averages.avgSleep} <span className="text-lg">horas</span>
                </div>
                <p className="text-sm text-gray-400">
                  Promedio diario
                </p>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-6 shadow-md">
                <div className="flex items-center mb-4">
                  <span className="text-2xl mr-3">🔥</span>
                  <h3 className={`text-lg font-semibold ${protoMono.className}`}>Calorías</h3>
                </div>
                <div className="text-3xl font-bold text-orange-400 mb-2">
                  {averages.avgCalories} <span className="text-lg">kcal</span>
                </div>
                <p className="text-sm text-gray-400">
                  Promedio diario
                </p>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-6 shadow-md">
              <h3 className={`text-lg font-semibold mb-4 ${protoMono.className}`}>
                Historial de actividad
              </h3>
              
              <div className="overflow-x-auto">
                <table className="min-w-full bg-gray-700 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-gray-600">
                      <th className="px-4 py-3 text-left text-sm font-semibold">Fecha</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Pasos</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Sueño (horas)</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Calorías</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityData.map((day, index) => (
                      <tr 
                        key={day.date} 
                        className={`border-t border-gray-600 ${index % 2 === 0 ? 'bg-gray-700' : 'bg-gray-750'}`}
                      >
                        <td className="px-4 py-3 text-sm">
                          {new Date(day.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {day.steps.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {day.sleep_hours}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {day.calories} kcal
                        </td>
                      </tr>
                    ))}
                    
                    {activityData.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-sm text-center text-gray-400">
                          No hay datos de actividad disponibles
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="container mx-auto text-gray-400 text-sm">
          <p>Entorno de prueba para integración con Rook Connect</p>
        </div>
      </footer>
    </div>
  );
} 