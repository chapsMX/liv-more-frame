"use client";

import { useEffect, useState } from "react";
import { protoMono } from '../styles/fonts';
import { CaloriesIcon, StepsIcon, SleepIcon } from '../styles/svg/index';
import sdk, { type Context } from "@farcaster/frame-sdk";
import GoalsModal from './GoalsModal';
import ConnectDeviceModal from './ConnectDeviceModal';
import Image from 'next/image';

interface UserGoals {
  calories_goal: number;
  steps_goal: number;
  sleep_hours_goal: number;
}

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [context, setContext] = useState<Context.FrameContext>();
  const [hasGoals, setHasGoals] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [goals, setGoals] = useState<UserGoals | null>(null);

  const checkUserGoals = async () => {
    try {
      if (!context?.user?.fid) {
        console.log('FID no disponible en el contexto del Dashboard');
        return;
      }

      const response = await fetch(`/api/goals/check?user_fid=${context.user.fid}`);
      const data = await response.json();
      
      if (data.hasGoals) {
        setGoals(data.goals);
        setHasGoals(true);
        setShowGoalsModal(false);
      } else {
        setShowGoalsModal(true);
      }
    } catch (error) {
      console.error('Error checking user goals:', error);
    }
  };

  const checkUserConnection = async () => {
    try {
      if (!context?.user?.fid) return;

      const response = await fetch(`/api/auth/check-connection?user_fid=${context.user.fid}`);
      const data = await response.json();
      
      if (data.isConnected) {
        setIsConnected(true);
        setShowConnectModal(false);
      } else if (hasGoals) {
        // Si tiene objetivos pero no está conectado, mostramos el modal de conexión
        setShowConnectModal(true);
      }
    } catch (error) {
      console.error('Error checking user connection:', error);
    }
  };

  const handleSaveGoals = async (newGoals: { calories: number; steps: number; sleep: number }) => {
    try {
      if (!context?.user?.fid) return;

      const response = await fetch('/api/goals/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_fid: context.user.fid,
          calories_goal: newGoals.calories,
          steps_goal: newGoals.steps,
          sleep_hours_goal: newGoals.sleep
        }),
      });

      const data = await response.json();
      if (data.success) {
        setGoals({
          calories_goal: newGoals.calories,
          steps_goal: newGoals.steps,
          sleep_hours_goal: newGoals.sleep
        });
        setHasGoals(true);
        setShowGoalsModal(false);
      }
    } catch (error) {
      console.error('Error saving goals:', error);
    }
  };

  const handleConnectDevice = async (provider: string) => {
    try {
      // Por ahora solo manejamos Google Fit
      if (provider === 'google') {
        // Aquí irá la lógica de conexión con Google Fit
        setIsConnected(true);
        setShowConnectModal(false);
      }
    } catch (error) {
      console.error('Error connecting device:', error);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  useEffect(() => {
    const load = async () => {
      try {
        console.log("Iniciando carga del SDK en Dashboard");
        const context = await sdk.context;
        console.log("Contexto obtenido en Dashboard:", context);
        setContext(context);
      } catch (error) {
        console.error("Error al cargar el SDK en Dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  // Efecto separado para checkUserGoals que depende del contexto
  useEffect(() => {
    if (context?.user?.fid) {
      console.log('Verificando objetivos con FID:', context.user.fid);
      checkUserGoals();
    }
  }, [context?.user?.fid]);

  // Efecto para verificar la conexión cuando cambian los objetivos
  useEffect(() => {
    if (hasGoals) {
      checkUserConnection();
    }
  }, [hasGoals]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-t-2 border-white rounded-full animate-spin"></div>
          <p className={protoMono.className}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasGoals) {
    return <GoalsModal onSave={handleSaveGoals} />;
  }

  if (!isConnected) {
    return (
      <ConnectDeviceModal
        onClose={() => setShowConnectModal(false)}
        onConnect={handleConnectDevice}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center w-full max-w-2xl mb-2 mx-auto">
          <div className="flex items-center">
            <Image
              src="/livMore_w.png"
              alt="Liv More"
              width={64}
              height={64}
              priority
            />
          </div>
          {context?.user && context.user.pfpUrl && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-full text-white min-w-[150px] border-2 border-gray-700">
                <Image
                  src={context.user.pfpUrl}
                  alt="Profile"
                  width={32}
                  height={32}
                  className="rounded-full border-2 border-gray-700"
                  unoptimized
                />
                <span className={`text-base font-semibold ${protoMono.className}`}>{context.user.username}</span>
              </div>
              <button 
                onClick={() => setShowControlPanel(true)}
                className="p-2 hover:bg-gray-800 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Main Content Box */}
        <div className="relative border-2 border-gray-800 bg-gray-900 rounded-2xl p-4 max-w-2xl w-full mx-auto overflow-hidden mb-4war">
          <div className={`relative z-10 text-center space-y-2 ${protoMono.className}`}>
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-bold">Liv More</h1>
            </div>
            <p className="text-base leading-relaxed mt-2 text-gray-300">
              Gamifying wellness by integrating wearable devices, blockchain attestations, and social challenges.
            </p>
          </div>
        </div>

        {/* Daily Activity Section */}
        <div className="max-w-2xl mx-auto text-center">
          <h2 className={`text-xl font-bold mb-1 ${protoMono.className}`}>Daily Activity</h2>
          <p className="text-gray-400 text-sm mb-6">{formatDate(new Date())}</p>

          <div className="grid grid-cols-3 gap-8">
            {/* Calories */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-gray-700 flex items-center justify-center">
                  <CaloriesIcon className="w-10 h-10" />
                </div>
                <div className="absolute inset-0 rounded-full border-4 border-red-500" style={{ clipPath: 'inset(50% 0 0 0)' }}></div>
              </div>
              <div className="mt-4 text-center">
                <p className={`text-base font-bold ${protoMono.className}`}>
                  <span className="text-white">0</span>
                  <span className="text-gray-500">/{goals?.calories_goal || '-'}</span>
                </p>
                <p className={`text-[10px] text-gray-500 uppercase tracking-wide ${protoMono.className}`}>Calories</p>
              </div>
            </div>

            {/* Steps */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-gray-700 flex items-center justify-center">
                  <StepsIcon className="w-10 h-10" />
                </div>
                <div className="absolute inset-0 rounded-full border-4 border-red-500" style={{ clipPath: 'inset(50% 0 0 0)' }}></div>
              </div>
              <div className="mt-4 text-center">
                <p className={`text-base font-bold ${protoMono.className}`}>
                  <span className="text-white">0</span>
                  <span className="text-gray-500">/{goals?.steps_goal?.toLocaleString() || '-'}</span>
                </p>
                <p className={`text-[10px] text-gray-500 uppercase tracking-wide ${protoMono.className}`}>Steps</p>
              </div>
            </div>

            {/* Sleep */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-gray-700 flex items-center justify-center">
                  <SleepIcon className="w-10 h-10" />
                </div>
                <div className="absolute inset-0 rounded-full border-4 border-green-500"></div>
              </div>
              <div className="mt-4 text-center">
                <p className={`text-base font-bold ${protoMono.className}`}>
                  <span className="text-white">0</span>
                  <span className="text-gray-500">/{goals?.sleep_hours_goal || '-'}h</span>
                </p>
                <p className={`text-[10px] text-gray-500 uppercase tracking-wide ${protoMono.className}`}>Sleep</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Control Panel Modal */}
      {showControlPanel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1C1F2A] p-8 rounded-3xl w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-2xl font-bold text-white ${protoMono.className}`}>Control Panel</h2>
              <button 
                onClick={() => setShowControlPanel(false)}
                className="p-2 hover:bg-gray-800 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <button
                onClick={() => setShowGoalsModal(true)}
                className={`w-full p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-left ${protoMono.className}`}
              >
                Update Daily Goals
              </button>
              <button
                onClick={() => isConnected ? setIsConnected(false) : setShowConnectModal(true)}
                className={`w-full p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-left ${protoMono.className}`}
              >
                {isConnected ? 'Disconnect Device' : 'Connect Device'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goals Modal */}
      {showGoalsModal && <GoalsModal onSave={handleSaveGoals} />}

      {/* Connect Device Modal */}
      {showConnectModal && (
        <ConnectDeviceModal
          onClose={() => setShowConnectModal(false)}
          onConnect={handleConnectDevice}
        />
      )}
    </div>
  );
} 