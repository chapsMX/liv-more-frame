"use client";

import { useEffect, useState, useCallback } from "react";
import { protoMono } from '../styles/fonts';
import sdk from "@farcaster/frame-sdk";
import GoalsModal from './GoalsModal';
import ConnectDeviceModal from './ConnectDeviceModal';
import Loader from './Loader';
import DashboardGoogle from './DashboardGoogle';

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasGoals, setHasGoals] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [userFid, setUserFid] = useState('');
  const [provider, setProvider] = useState<string | null>(null);

  const checkUserGoals = useCallback(async () => {
    try {
      if (!userFid) {
        console.log('FID no disponible en el estado del Dashboard');
        return;
      }

      setIsTransitioning(true);
      const response = await fetch(`/api/goals/check?user_fid=${userFid}`);
      const data = await response.json();
      
      if (data.hasGoals) {
        setHasGoals(true);
        setShowGoalsModal(false);
      } else {
        setShowGoalsModal(true);
      }
    } catch (error) {
      console.error('Error checking user goals:', error);
    } finally {
      setIsTransitioning(false);
    }
  }, [userFid]);

  const checkUserConnection = useCallback(async () => {
    try {
      if (!userFid) return;

      setIsTransitioning(true);
      const response = await fetch(`/api/auth/check-connection?user_fid=${userFid}`);
      const data = await response.json();
      
      if (data.isConnected) {
        setIsConnected(true);
        setShowConnectModal(false);
      } else if (hasGoals) {
        setShowConnectModal(true);
      }
    } catch (error) {
      console.error('Error checking user connection:', error);
    } finally {
      setIsTransitioning(false);
    }
  }, [userFid, hasGoals]);

  const handleSaveGoals = async (newGoals: { calories: number; steps: number; sleep: number }) => {
    try {
      if (!userFid) return;

      const response = await fetch('/api/goals/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_fid: userFid,
          calories_goal: newGoals.calories,
          steps_goal: newGoals.steps,
          sleep_hours_goal: newGoals.sleep
        }),
      });

      const data = await response.json();
      if (data.success) {
        setHasGoals(true);
        setShowGoalsModal(false);
      }
    } catch (error) {
      console.error('Error saving goals:', error);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const context = await sdk.context;
        console.log('Dashboard context:', context);
        
        if (context.user?.fid) {
          const fid = context.user.fid.toString();
          console.log('Dashboard FID:', fid);
          setUserFid(fid);
          await checkUserProvider(fid);
        } else {
          console.log('Esperando FID en Dashboard...');
        }
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (userFid) {
      checkUserGoals();
      checkUserConnection();
    }
  }, [userFid, checkUserGoals, checkUserConnection]);

  const checkUserProvider = async (fid: string) => {
    try {
      const response = await fetch(`/api/auth/check-provider?user_fid=${fid}`);
      const data = await response.json();
      
      if (data.success && data.provider) {
        setProvider(data.provider);
      } else {
        setShowConnectModal(true);
      }
    } catch (error) {
      console.error('Error checking user provider:', error);
      setShowConnectModal(true);
    }
  };

  const handleConnect = async (selectedProvider: string) => {
    setProvider(selectedProvider);
    setShowConnectModal(false);
  };

  if (isLoading) {
    return <Loader message="Loading dashboard..." />;
  }

  if (isTransitioning) {
    return <Loader message="Updating your data..." />;
  }

  if (!hasGoals) {
    return <GoalsModal onSave={handleSaveGoals} />;
  }

  if (!isConnected) {
    return (
      <ConnectDeviceModal
        onClose={() => setShowConnectModal(false)}
        onConnect={handleConnect}
        userFid={userFid}
      />
    );
  }

  switch (provider) {
    case 'google':
      return <DashboardGoogle />;
    default:
  return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="text-center">
            <h1 className={`text-2xl font-bold mb-4 ${protoMono.className}`}>No Provider Selected</h1>
            <p className={`text-gray-400 mb-4 ${protoMono.className}`}>Please connect a device to continue.</p>
              <button 
              onClick={() => setShowConnectModal(true)}
              className={`px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors ${protoMono.className}`}
            >
              Connect Device
              </button>
          </div>
    </div>
  );
  }
} 