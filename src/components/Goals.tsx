'use client';

import React, { useState } from 'react';
import { protoMono } from '../styles/fonts';
import Image from 'next/image';

interface GoalsProps {
  onSave: () => void;
  displayName: string;
}

const Goals = ({ onSave, displayName }: GoalsProps) => {
  const [steps, setSteps] = useState('10000');
  const [calories, setCalories] = useState('2500');
  const [sleep, setSleep] = useState('8');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      // Guardar objetivos en la base de datos
      const response = await fetch('/api/goals/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-fid': '123' // TODO: Obtener el FID real del usuario
        },
        body: JSON.stringify({
          steps: parseInt(steps),
          calories: parseInt(calories),
          sleep: parseFloat(sleep)
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al guardar los objetivos');
      }

      onSave();
    } catch (error) {
      console.error('Error al guardar objetivos:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col">
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-6 w-full max-w-xl">
          <div className={`text-center ${protoMono.className} space-y-2`}>
            <h1 className="text-2xl font-bold">¡Bienvenido/a {displayName}!</h1>
            <p className="text-gray-400">
              Configura tus objetivos diarios de fitness para comenzar a rastrear tu progreso
            </p>
          </div>

          <div className="bg-gray-900 border-2 border-gray-800 rounded-xl p-6 w-full">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className={`${protoMono.className} block text-sm text-gray-400`}>
                    Pasos Diarios
                  </label>
                  <input
                    type="number"
                    value={steps}
                    onChange={(e) => setSteps(e.target.value)}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg px-4 py-2 text-white"
                    min="1000"
                    max="100000"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className={`${protoMono.className} block text-sm text-gray-400`}>
                    Calorías (kcal)
                  </label>
                  <input
                    type="number"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg px-4 py-2 text-white"
                    min="500"
                    max="10000"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className={`${protoMono.className} block text-sm text-gray-400`}>
                    Horas de Sueño
                  </label>
                  <input
                    type="number"
                    value={sleep}
                    onChange={(e) => setSleep(e.target.value)}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg px-4 py-2 text-white"
                    min="4"
                    max="12"
                    step="0.5"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="text-red-600 text-center">
                  <p>{error}</p>
                </div>
              )}

              <div className="flex justify-center">
                <button
                  type="submit"
                  disabled={saving}
                  className={`
                    ${protoMono.className} w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors
                  `}
                >
                  {saving ? 'Guardando...' : 'Guardar Objetivos'}
                </button>
              </div>
            </form>
          </div>
        </div>
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

export default Goals; 