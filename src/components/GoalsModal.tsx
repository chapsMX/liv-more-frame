"use client";

import { useState } from "react";
import { protoMono } from '../styles/fonts';
import { CaloriesIcon, StepsIcon, SleepIcon } from '../styles/svg/index';

interface GoalsModalProps {
  onSave: (goals: { calories: number; steps: number; sleep: number }) => void;
}

export default function GoalsModal({ onSave }: GoalsModalProps) {
  const [calories, setCalories] = useState(350);
  const [steps, setSteps] = useState(7500);
  const [sleep, setSleep] = useState(7);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      calories,
      steps,
      sleep
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-[#1C1F2A] p-8 rounded-3xl w-full max-w-md">
        <h2 className={`text-2xl font-bold mb-2 text-white ${protoMono.className}`}>
          Set your Daily Goals
        </h2>
        
        <p className={`text-gray-300 mb-8 ${protoMono.className}`}>
          To use LivMore, you need to set your daily goals first. These goals will help you track your daily progress and can be modified at any time.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Calories Goal */}
          <div>
            <label className="flex items-center mb-2 text-white">
              <CaloriesIcon className="w-6 h-6 mr-2 text-white" />
              <span className={`${protoMono.className}`}>Daily Calories Goal</span>
            </label>
            <input
              type="number"
              value={calories}
              onChange={(e) => setCalories(parseInt(e.target.value))}
              className="w-full p-3 bg-[#2A2F3E] rounded-lg text-white"
              min="0"
              required
            />
          </div>

          {/* Steps Goal */}
          <div>
            <label className="flex items-center mb-2 text-white">
              <StepsIcon className="w-6 h-6 mr-2 text-white" />
              <span className={`${protoMono.className}`}>Daily Steps Goal</span>
            </label>
            <input
              type="number"
              value={steps}
              onChange={(e) => setSteps(parseInt(e.target.value))}
              className="w-full p-3 bg-[#2A2F3E] rounded-lg text-white"
              min="0"
              required
            />
          </div>

          {/* Sleep Goal */}
          <div>
            <label className="flex items-center mb-2 text-white">
              <SleepIcon className="w-6 h-6 mr-2 text-white" />
              <span className={`${protoMono.className}`}>Daily Sleep Hours Goal</span>
            </label>
            <input
              type="number"
              value={sleep}
              onChange={(e) => setSleep(parseFloat(e.target.value))}
              className="w-full p-3 bg-[#2A2F3E] rounded-lg text-white"
              min="0"
              step="0.5"
              required
            />
          </div>

          <button
            type="submit"
            className={`w-full mt-8 bg-violet-500 text-white py-4 px-6 rounded-xl hover:bg-violet-600 transition-colors ${protoMono.className}`}
          >
            Save Goals
          </button>
        </form>
      </div>
    </div>
  );
} 