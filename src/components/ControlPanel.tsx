"use client";

import { useEffect, useState } from 'react';
import { protoMono } from '../styles/fonts';
import { useUser } from '../context/UserContext';
import DGModal from './DGModal';
import { validateGoals } from '@/constants/goals';

interface ControlPanelProps {
  onClose: () => void;
}

interface UserGoals {
  calories: number;
  steps: number;
  sleep: number;
}

export function ControlPanel({ onClose }: ControlPanelProps) {
  const { userState } = useUser();
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const [goalsValidation, setGoalsValidation] = useState<ReturnType<typeof validateGoals> | null>(null);

  useEffect(() => {
    fetchUserGoals();
  }, []);

  const fetchUserGoals = async () => {
    try {
      const response = await fetch(`/api/users/check-goals?fid=${userState.userFid}`);
      const data = await response.json();
      
      if (data.hasGoals) {
        setGoals(data.goals);
        setGoalsValidation(data.validation);
        // Mostrar modal automáticamente si los valores son inválidos
        if (!data.validation.isValid) {
          setShowGoalsModal(true);
        }
      }
    } catch (error) {
      console.error('Error fetching user goals:', error);
    }
  };

  const handleSaveGoals = async (newGoals: UserGoals) => {
    const validation = validateGoals(newGoals);
    if (!validation.isValid) {
      return; // No permitir guardar si los valores son inválidos
    }

    try {
      const response = await fetch('/api/users/save-goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_fid: userState.userFid,
          ...newGoals
        }),
      });

      const data = await response.json();
      if (data.success) {
        setGoals(newGoals);
        setGoalsValidation(validation);
        setShowGoalsModal(false);
      }
    } catch (error) {
      console.error('Error saving goals:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-gray-900 border-2 border-gray-700 rounded-xl p-6 max-w-md w-full mx-4 relative">
        {/* Botón de cerrar */}
        <button 
          onClick={onClose}
          className="absolute -top-4 -right-2 text-gray-400 hover:text-white transition-colors bg-gray-900 rounded-full p-1 border-2 border-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className={`${protoMono.className} space-y-6`}>
          <h2 className="text-xl font-bold text-white">Control Panel</h2>
          
          {/* Información del Usuario */}
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-gray-700">
              <span className="text-gray-400">Username</span>
              <span className="text-white">{userState.username}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-700">
              <span className="text-gray-400">Display Name</span>
              <span className="text-white">{userState.displayName}</span>
            </div>

            {/* Daily Goals Section */}
            <div className="py-2 border-b border-gray-700">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400">Daily Goals</span>
                <button
                  onClick={() => setShowGoalsModal(true)}
                  className="text-violet-400 hover:text-violet-300 transition-colors text-sm flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit Goals
                </button>
              </div>
              {goals ? (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className={`bg-gray-800 p-2 rounded-lg ${goalsValidation?.invalidFields.calories ? 'border-2 border-red-500' : ''}`}>
                    <div className="text-gray-400">Calories</div>
                    <div className="text-white font-medium">{goals.calories.toLocaleString()}</div>
                  </div>
                  <div className={`bg-gray-800 p-2 rounded-lg ${goalsValidation?.invalidFields.steps ? 'border-2 border-red-500' : ''}`}>
                    <div className="text-gray-400">Steps</div>
                    <div className="text-white font-medium">{goals.steps.toLocaleString()}</div>
                  </div>
                  <div className={`bg-gray-800 p-2 rounded-lg ${goalsValidation?.invalidFields.sleep ? 'border-2 border-red-500' : ''}`}>
                    <div className="text-gray-400">Sleep</div>
                    <div className="text-white font-medium">{goals.sleep}h</div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-sm">Loading goals...</div>
              )}
            </div>
          </div>

          {/* Opciones */}
          <div className="space-y-2">
            <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
            <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Help
            </button>
            <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-red-900 text-red-500 transition-colors flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Goals Modal */}
      {showGoalsModal && (
        <DGModal 
          onSave={handleSaveGoals} 
          initialGoals={goals || undefined}
        />
      )}
    </div>
  );
} 