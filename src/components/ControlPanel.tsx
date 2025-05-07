"use client";

import { useEffect, useState, useCallback } from 'react';
import { protoMono } from '../styles/fonts';

interface ControlPanelProps {
  onClose: () => void;
  userFid: string;
}

interface DeviceStatus {
  google: boolean;
  garmin: boolean;
  oura: boolean;
}

export default function ControlPanel({ onClose, userFid }: ControlPanelProps) {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({
    google: false,
    garmin: false,
    oura: false
  });

  const checkDevicesStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/auth/check-provider?user_fid=${userFid}`);
      const data = await response.json();
      
      setDeviceStatus({
        google: data.provider === 'google',
        garmin: data.provider === 'garmin',
        oura: false // Por ahora siempre false ya que no está implementado
      });
    } catch (error) {
      console.error('Error checking devices status:', error);
    }
  }, [userFid]);

  useEffect(() => {
    checkDevicesStatus();
  }, [checkDevicesStatus]);

  const handleGoogleConnection = async () => {
    try {
      if (deviceStatus.google) {
        // Desconectar
        const response = await fetch('/api/auth/google/disconnect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_fid: userFid }),
        });
        const data = await response.json();
        if (data.success) {
          setDeviceStatus(prev => ({ ...prev, google: false }));
          // Recargar la página después de 3 segundos
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      } else {
        // Conectar (redirigir a Google OAuth)
        window.location.href = `/auth/google/connect?user_fid=${userFid}`;
      }
    } catch (error) {
      console.error('Error handling Google connection:', error);
    }
  };

  const handleGarminConnection = async () => {
    try {
      if (deviceStatus.garmin) {
        // Desconectar
        const response = await fetch('/api/auth/garmin/disconnect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_fid: userFid }),
        });
        const data = await response.json();
        if (data.success) {
          setDeviceStatus(prev => ({ ...prev, garmin: false }));
          // Recargar la página después de 3 segundos
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      } else {
        // Conectar (redirigir a Garmin OAuth)
        window.location.href = `/auth/garmin/connect?user_fid=${userFid}`;
      }
    } catch (error) {
      console.error('Error handling Garmin connection:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-[#1C1F2A] p-2 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h2 className={`text-2xl font-bold text-white ${protoMono.className}`}>Control Panel</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sección de Dispositivos */}
          <section className="bg-gray-900 p-3 rounded-2xl border border-gray-800">
            <h3 className={`text-xl font-bold text-center mb-4 ${protoMono.className}`}>Available Wearables</h3>
            <div className="space-y-2">
              {/* Google Fit */}
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className={protoMono.className}>Fitness by Google</span>
                </div>
                <button 
                  onClick={handleGoogleConnection}
                  className={`p-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-center border-2 ${
                    deviceStatus.google 
                      ? 'border-red-500' 
                      : 'border-orange-500'
                  } ${protoMono.className}`}
                >
                  <span className="text-white text-sm">
                    {deviceStatus.google ? 'Disconnect' : 'Connect'}
                  </span>
                </button>
              </div>

              {/* Garmin */}
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className={protoMono.className}>Garmin Connect</span>
                </div>
                <button 
                  onClick={handleGarminConnection}
                  className={`p-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-center border-2 ${
                    deviceStatus.garmin 
                      ? 'border-red-500' 
                      : 'border-orange-500'
                  } ${protoMono.className}`}
                >
                  <span className="text-white text-sm">
                    {deviceStatus.garmin ? 'Disconnect' : 'Connect'}
                  </span>
                </button>
              </div>

              {/* Oura Ring */}
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className={protoMono.className}>Oura Ring</span>
                </div>
                <button 
                  disabled
                  className={`p-2 bg-gray-800 opacity-50 cursor-not-allowed rounded-xl text-center border-2 border-gray-700 ${protoMono.className}`}
                >
                  <span className="text-gray-500 text-sm">Coming Soon</span>
                </button>
              </div>
            </div>
          </section>

          {/* Sección de Objetivos */}
          <section className="bg-gray-900 p-3 rounded-2xl border border-gray-800">
            <h3 className={`text-xl font-bold text-center mb-4 ${protoMono.className}`}>Daily Goals</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                <span className={protoMono.className}>Update Goals</span>
                <button className={`p-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-center border-2 border-orange-500 ${protoMono.className}`}>
                  <span className="text-white text-sm">Modify</span>
                </button>
              </div>
            </div>
          </section>

          {/* Sección de Atestaciones */}
          <section className="bg-gray-900 p-6 rounded-2xl border border-gray-800">
            <h3 className={`text-xl font-bold text-center mb-4 ${protoMono.className}`}>Attestations</h3>
            <div className="space-y-4">
              <div className="p-3 bg-gray-800 rounded-xl">
                <p className={`text-gray-400 ${protoMono.className}`}>
                  Your fitness data attestations will appear here
                </p>
              </div>
            </div>
          </section>

          {/* Sección de Badges */}
          <section className="bg-gray-900 p-3 rounded-2xl border border-gray-800">
            <h3 className={`text-xl font-bold text-center mb-4 ${protoMono.className}`}>Badges</h3>
            <div className="space-y-2">
              <div className="p-3 bg-gray-800 rounded-xl">
                <p className={`text-gray-400 ${protoMono.className}`}>
                  Complete challenges to earn badges
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
} 