"use client";

import { useState, useEffect } from "react";
import { protoMono } from '../styles/fonts';
import { CaloriesIcon, StepsIcon, SleepIcon } from '../styles/svg/index';
import { MIN_GOALS, validateGoals } from '@/constants/goals';
import { sdk } from "@farcaster/frame-sdk";
import { useUser } from '../context/UserContext';

interface GoalsModalProps {
  onSave: (goals: { calories: number; steps: number; sleep: number }) => void;
  initialGoals?: { calories: number; steps: number; sleep: number };
}

export default function DGModal({ onSave, initialGoals }: GoalsModalProps) {
  const { userState } = useUser();
  const [calories, setCalories] = useState(initialGoals?.calories || MIN_GOALS.CALORIES);
  const [steps, setSteps] = useState(initialGoals?.steps || MIN_GOALS.STEPS);
  const [sleep, setSleep] = useState(initialGoals?.sleep || MIN_GOALS.SLEEP);
  const [validation, setValidation] = useState(validateGoals({ calories, steps, sleep }));
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    const newValidation = validateGoals({ calories, steps, sleep });
    setValidation(newValidation);
  }, [calories, steps, sleep]);

  const shareGoals = async () => {
    try {
      setIsSharing(true);
      
      // Crear ID único para la imagen
      const time = Math.floor(Date.now() / 1000);
      const shareID = `${userState.userFid}-${time}`;
      
      // Texto del cast
      const shareText = `🎯 I just set my daily goals on @livmore!\n\n` +

        `💪 I'm ready to crush these goals! Who's joining me? 🚀`;
      
      // URL de la imagen dinámica
      const frameUrl = `${process.env.NEXT_PUBLIC_URL}/di-goals/${shareID}`;
      
      // Compartir usando SDK de Farcaster
      await sdk.actions.composeCast({
        text: shareText,
        embeds: [frameUrl]
      });
      
    } catch (error) {
      console.error('Error sharing goals:', error);
    } finally {
      setIsSharing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid) {
      return;
    }
    
    // Primero guardar los objetivos
    onSave({
      calories,
      steps,
      sleep
    });
    
    // Luego compartir automáticamente
    await shareGoals();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 z-50">
      <div className="bg-[#1C1F2A] p-6 rounded-3xl w-full max-w-md relative">
        <h2 className={`text-md text-center font-bold mb-2 text-white ${protoMono.className}`}>
        Let&apos;s start strong, set your daily goals to begin tracking your progress.<br />
        <span className="text-gray-400 text-left text-xs">*You can adjust them anytime as you go.</span>
        </h2>

        <form onSubmit={handleSubmit} className="space-y-2">
          {/* Calories Goal */}
          <div>
            <label className="flex items-center mb-2 text-white">
              <CaloriesIcon className="w-6 h-6 mr-2 text-white" />
              <span className={`${protoMono.className}`}>Daily Calories:</span>
            </label>
            <input
              type="number"
              value={calories}
              onChange={(e) => setCalories(Math.max(MIN_GOALS.CALORIES, parseInt(e.target.value)))}
              className={`w-full p-3 bg-[#2A2F3E] rounded-lg text-white ${validation.invalidFields.calories ? 'border-2 border-red-500' : ''}`}
              min={MIN_GOALS.CALORIES}
              required
            />
            <p className={`text-sm text-gray-400 mt-1 ${protoMono.className}`}>Minimum: {MIN_GOALS.CALORIES.toLocaleString()} calories</p>
          </div>

          {/* Steps Goal */}
          <div>
            <label className="flex items-center mb-2 text-white">
              <StepsIcon className="w-6 h-6 mr-2 text-white" />
              <span className={`${protoMono.className}`}>Daily Steps:</span>
            </label>
            <input
              type="number"
              value={steps}
              onChange={(e) => setSteps(Math.max(MIN_GOALS.STEPS, parseInt(e.target.value)))}
              className={`w-full p-3 bg-[#2A2F3E] rounded-lg text-white ${validation.invalidFields.steps ? 'border-2 border-red-500' : ''}`}
              min={MIN_GOALS.STEPS}
              required
            />
                <p className={`text-sm text-gray-400 mt-1 ${protoMono.className}`}>Minimum: {MIN_GOALS.STEPS.toLocaleString()} steps</p>
            </div>

          {/* Sleep Goal */}
          <div>
            <label className="flex items-center mb-2 text-white">
              <SleepIcon className="w-6 h-6 mr-2 text-white" />
              <span className={`${protoMono.className}`}>Daily Sleep Hours:</span>
            </label>
            <input
              type="number"
              value={sleep}
              onChange={(e) => setSleep(Math.max(MIN_GOALS.SLEEP, parseFloat(e.target.value)))}
              className={`w-full p-3 bg-[#2A2F3E] rounded-lg text-white ${validation.invalidFields.sleep ? 'border-2 border-red-500' : ''}`}
              min={MIN_GOALS.SLEEP}
              step="0.5"
              required
            />
            <p className={`text-sm text-gray-400 mt-1 ${protoMono.className}`}>Minimum: {MIN_GOALS.SLEEP} hours</p>
          </div>

          <button
            type="submit"
            disabled={!validation.isValid || isSharing}
            className={`w-full mt-8 ${validation.isValid && !isSharing ? 'bg-violet-500 hover:bg-violet-600' : 'bg-gray-500 cursor-not-allowed'} text-white py-4 px-6 rounded-xl transition-colors ${protoMono.className} flex items-center justify-center gap-2`}
          >
            {isSharing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving & Sharing...
              </>
            ) : (
              'Save & Share Goals'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
