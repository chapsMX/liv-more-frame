"use client";

import { useState, useEffect } from 'react';
import { protoMono } from '../styles/fonts';
import { RookActivityData } from './DailyActivity';

interface RookDataDisplayProps {
  userFid: string;
  date?: string;
  data?: RookActivityData | null;
}

export default function RookDataDisplay({ userFid, date, data }: RookDataDisplayProps) {
  const [loading, setLoading] = useState<boolean>(false);

  // Agrega un log para ver cuando se renderiza este componente
  useEffect(() => {
    console.log("RookDataDisplay renderizado con datos:", data ? "disponibles" : "no disponibles");
  }, [data]);

  // Si recibimos los datos como prop, usamos esos
  const hasData = data !== null && data !== undefined;

  if (loading) {
    return (
      <div className="text-center p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <div className="animate-pulse">Cargando datos de salud...</div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg shadow-lg">
        <h2 className={`text-xl font-bold mb-4 ${protoMono.className}`}>
          Datos de Salud
        </h2>
        <div className="text-center py-6">
          <p className="text-gray-400">Sin datos de salud para mostrar</p>
          <button 
            onClick={() => window.location.href = `/api/rook/connect?user_fid=${userFid}`}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Actualizar Datos
          </button>
        </div>
      </div>
    );
  }

  // Usando data! aseguramos a TypeScript que data no es null ni undefined
  const safeData = data!;
  
  return (
    <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg shadow-lg">
      <h2 className={`text-xl font-bold mb-4 ${protoMono.className}`}>
        Datos de Salud • {safeData.date}
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className={`text-lg font-semibold mb-2 text-blue-400 ${protoMono.className}`}>Actividad Física</h3>
          <p className="text-white"><span className="font-medium">Pasos:</span> {safeData.physical.steps.toLocaleString()}</p>
          <p className="text-white"><span className="font-medium">Calorías:</span> {safeData.physical.calories.toLocaleString()} kcal</p>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className={`text-lg font-semibold mb-2 text-indigo-400 ${protoMono.className}`}>Sueño</h3>
          <p className="text-white"><span className="font-medium">Horas:</span> {safeData.sleep.hours.toFixed(1)}</p>
          <p className="text-white"><span className="font-medium">Eficiencia:</span> {safeData.sleep.efficiency ? `${Math.round(safeData.sleep.efficiency * 100)}%` : 'N/A'}</p>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className={`text-lg font-semibold mb-2 text-green-400 ${protoMono.className}`}>Estado</h3>
          <p className="text-white">Conexión: <span className="text-green-400">Activa</span></p>
          <p className="text-white">Proveedor: <span className="text-green-400">Rook</span></p>
        </div>
      </div>
      
      <div className="text-right">
        <button 
          onClick={() => window.location.href = `/api/rook/connect?user_fid=${userFid}`}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
        >
          Actualizar Datos
        </button>
      </div>
    </div>
  );
} 