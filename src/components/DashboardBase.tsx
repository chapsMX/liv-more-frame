"use client";

import { useEffect, useState } from "react";
import { protoMono } from '../styles/fonts';
import Image from 'next/image';
import sdk, { type Context } from "@farcaster/frame-sdk";
import Loader from './Loader';
import Footer from './Footer';
import ControlPanel from './ControlPanel';
import DailyActivity, { RookActivityData } from './DailyActivity';
import WeeklyStats from './WeeklyStats';

export interface ActivityData {
  calories: number;
  steps: number;
  sleepHours: number;
}

interface DashboardBaseProps {
  children: React.ReactNode;
}

export default function DashboardBase({ children }: DashboardBaseProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [context, setContext] = useState<Context.FrameContext>();
  const [userFid, setUserFid] = useState('');
  const [canUse, setCanUse] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [rookData, setRookData] = useState<RookActivityData | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const context = await sdk.context;
        console.log('Dashboard context:', context);
        setContext(context);
        
        if (context.user?.fid) {
          const fid = context.user.fid.toString();
          console.log('Dashboard FID:', fid);
          setUserFid(fid);
          await checkUserAccess(fid);
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

  const checkUserAccess = async (fid: string) => {
    try {
      const response = await fetch(`/api/whitelist/check?user_fid=${fid}`);
      const data = await response.json();
      console.log('User access data:', data);
      
      if (data.is_whitelisted && data.can_use && data.accepted_tos && data.accepted_privacy_policy) {
        setCanUse(true);
        setHasAcceptedTerms(true);
      } else {
        console.log('User does not have access:', data);
        setCanUse(false);
        setHasAcceptedTerms(false);
      }
    } catch (error) {
      console.error('Error checking user access:', error);
      setCanUse(false);
      setHasAcceptedTerms(false);
    }
  };
  
  // Callback para recibir datos de DailyActivity
  const handleRookDataLoaded = (data: RookActivityData | null) => {
    // Usar una función de actualización de estado para evitar actualizaciones innecesarias
    setRookData(prevData => {
      // Si los datos son iguales, no hacemos nada
      if (JSON.stringify(prevData) === JSON.stringify(data)) {
        console.log('Datos de Rook sin cambios, evitando renderizado');
        return prevData;
      }
      
      console.log('Actualizando datos de Rook en DashboardBase');
      return data;
    });
  };

  if (isLoading) {
    return <Loader message="Loading dashboard..." />;
  }

  if (!canUse || !hasAcceptedTerms) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className={`text-2xl font-bold mb-4 ${protoMono.className}`}>Access Denied</h1>
            <p className={`text-gray-400 ${protoMono.className}`}>You don&apos;t have access to this application yet.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col">
      <main className="flex-grow container mx-auto px-2 py-2">
        {/* Header */}
        <div className="flex justify-between items-center w-full max-w-2xl mb-0 mx-auto">
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
            <div className="flex items-center gap-2">
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
                <button 
                  onClick={() => setShowControlPanel(true)}
                  className="p-1 hover:bg-gray-700 rounded-full transition-colors ml-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Health Data and Daily Activity */}
        <div className="w-full max-w-2xl mx-auto mt-4">
          {userFid && (
            <>
              <DailyActivity 
                userFid={userFid} 
                onDataLoaded={handleRookDataLoaded} 
              />
              <WeeklyStats 
                userFid={userFid} 
              />
            </>
          )}
        </div>

        {/* Dashboard Content */}
        {children}
      </main>
      <Footer />

      {/* Control Panel Modal */}
      {showControlPanel && (
        <ControlPanel
          onClose={() => setShowControlPanel(false)}
          userFid={userFid}
        />
      )}
    </div>
  );
} 