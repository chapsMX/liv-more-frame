"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { protoMono } from '../styles/fonts';
import { useUser } from '../context/UserContext';
import { useRouter } from 'next/navigation';
import { ControlPanel } from './ControlPanel';
import DGModal from './DGModal';
import sdk from "@farcaster/frame-sdk";

export default function DashboardInicial() {
  const { userState } = useUser();
  const router = useRouter();
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [pfpUrl, setPfpUrl] = useState<string>();
  const [goals, setGoals] = useState({ calories: 0, steps: 0, sleep: 0 });

  useEffect(() => {
    const loadUserProfile = async () => {
      const context = await sdk.context;
      if (context.user?.pfpUrl) {
        setPfpUrl(context.user.pfpUrl);
      }
    };

    loadUserProfile();
  }, []);

  useEffect(() => {
    console.log('🏠 Verificando acceso al Dashboard:', {
      usuario: userState.username,
      estado: {
        isWhitelisted: userState.isWhitelisted,
        acceptedTos: userState.acceptedTos,
        acceptedPrivacyPolicy: userState.acceptedPrivacyPolicy,
        canUse: userState.canUse
      }
    });

    if (!userState.isWhitelisted || !userState.acceptedTos || !userState.acceptedPrivacyPolicy || !userState.canUse) {
      console.log('⚠️ Acceso denegado al Dashboard:', {
        razon: {
          faltaWhitelist: !userState.isWhitelisted ? 'No está en whitelist' : null,
          faltaTos: !userState.acceptedTos ? 'No ha aceptado TOS' : null,
          faltaPP: !userState.acceptedPrivacyPolicy ? 'No ha aceptado Privacy Policy' : null,
          faltaCanUse: !userState.canUse ? 'No tiene permiso de uso' : null
        }
      });
      router.push('/');
    } else {
      console.log('✅ Acceso permitido al Dashboard');
      checkUserGoals();
    }
  }, [userState, router]);

  const checkUserGoals = async () => {
    try {
      const response = await fetch(`/api/users/check-goals?fid=${userState.userFid}`);
      const data = await response.json();
      
      if (data.hasGoals) {
        setGoals(data.goals);
        if (!data.validation.isValid) {
          setShowGoalsModal(true);
        }
      } else {
        setShowGoalsModal(true);
      }
    } catch (error) {
      console.error('Error checking user goals:', error);
    }
  };

  const handleSaveGoals = async (goals: { calories: number; steps: number; sleep: number }) => {
    try {
      const response = await fetch('/api/users/save-goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_fid: userState.userFid,
          ...goals
        }),
      });

      const data = await response.json();
      if (data.success) {
        setShowGoalsModal(false);
      }
    } catch (error) {
      console.error('Error saving goals:', error);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Header */}
        <div className="flex justify-between items-center w-full max-w-2xl mb-2">
          <div className="flex items-center">
            <Image
              src="/livMore_w.png"
              alt="Liv More"
              width={60}
              height={60}
              priority
            />
          </div>
          
          {/* User Profile with Kebab Menu */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2 py-1 bg-gray-800 rounded-full text-white min-w-[150px] border-2 border-gray-700">
              {pfpUrl && (
                <Image
                  src={pfpUrl}
                  alt="Profile"
                  width={32}
                  height={32}
                  className="rounded-full border-2 border-gray-700"
                  unoptimized
                />
              )}
              <span className={`text-base font-semibold ${protoMono.className}`}>
                {userState.username}
              </span>
              <button 
                onClick={() => setShowControlPanel(true)}
                className="ml-2 text-gray-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Coming Soon Card */}
          <div className="bg-gray-900 border-2 border-gray-700 rounded-xl p-6">
            <h2 className={`text-xl font-bold mb-4 ${protoMono.className}`}>
              🚀 Coming Soon
            </h2>
            <p className={`text-gray-400 ${protoMono.className}`}>
              We're working hard to bring you the best experience. Stay tuned for updates!
            </p>
          </div>
        </div>
      </div>

      {/* Control Panel Modal */}
      {showControlPanel && (
        <ControlPanel onClose={() => setShowControlPanel(false)} />
      )}

      {/* Goals Modal */}
      {showGoalsModal && (
        <DGModal 
          onSave={handleSaveGoals}
          initialGoals={goals}
        />
      )}
    </div>
  );
}
