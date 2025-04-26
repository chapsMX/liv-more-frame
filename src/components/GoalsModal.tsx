"use client";

import { useState, useEffect } from 'react';
import { protoMono } from '../styles/fonts';
import { Boton } from "../styles/ui/boton";
import sdk from "@farcaster/frame-sdk";

interface GoalsModalProps {
  onSave: (goals: { calories: number; steps: number; sleep: number }) => Promise<void>;
}

export default function GoalsModal({ onSave }: GoalsModalProps) {
  const [goals, setGoals] = useState({
    calories: 350,
    steps: 7500,
    sleep: 7
  });

  useEffect(() => {
    // Indicar que el modal está listo para ser mostrado
    sdk.actions.ready();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(goals);
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <h1 className={`text-2xl font-bold mb-6 text-center ${protoMono.className}`}>
            Configura tus objetivos diarios
          </h1>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Calorías a quemar (kcal)
                </label>
                <input
                  type="number"
                  value={goals.calories}
                  onChange={(e) => setGoals(prev => ({ ...prev, calories: Number(e.target.value) }))}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-violet-500"
                  min="100"
                  max="1000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Pasos diarios
                </label>
                <input
                  type="number"
                  value={goals.steps}
                  onChange={(e) => setGoals(prev => ({ ...prev, steps: Number(e.target.value) }))}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-violet-500"
                  min="1000"
                  max="20000"
                  step="500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Horas de sueño
                </label>
                <input
                  type="number"
                  value={goals.sleep}
                  onChange={(e) => setGoals(prev => ({ ...prev, sleep: Number(e.target.value) }))}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-violet-500"
                  min="4"
                  max="12"
                  step="0.5"
                />
              </div>
            </div>

            <Boton
              type="submit"
              className="w-full py-3 bg-violet-600 hover:bg-violet-700 rounded-xl"
            >
              Guardar Objetivos
            </Boton>
          </form>
        </div>
      </main>
    </div>
  );
} 