"use client";

import { useEffect, useState, useCallback } from 'react';
import { protoMono } from '../styles/fonts';
import { useUser } from '../context/UserContext';
import DGModal from './DGModal';
import { validateGoals } from '@/constants/goals';
import Image from 'next/image';
import sdk from "@farcaster/frame-sdk";
import { useRouter } from 'next/navigation';
import { isAuthorizedForTesting } from '@/utils/auth';

interface ControlPanelProps {
  onClose: () => void;
}

interface UserGoals {
  calories: number;
  steps: number;
  sleep: number;
}

interface ConnectedDevice {
  data_source: string;
  authorized: boolean;
}

interface RookResponse {
  provider: string | null;
  rook_user_id: string | null;
  connection_status: string;
  data_sources?: string[];
  rook_authorized_sources: {
    [key: string]: boolean;
  };
}

export function ControlPanel({ onClose }: ControlPanelProps) {
  const { userState } = useUser();
  const router = useRouter();
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const [goalsValidation, setGoalsValidation] = useState<ReturnType<typeof validateGoals> | null>(null);
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(true);
  const [isRevoking, setIsRevoking] = useState(false);
  const [pfpUrl, setPfpUrl] = useState<string>();

  useEffect(() => {
    const loadUserProfile = async () => {
      const context = await sdk.context;
      if (context.user?.pfpUrl) {
        setPfpUrl(context.user.pfpUrl);
      }
    };

    loadUserProfile();
  }, []);

  const fetchUserGoals = useCallback(async () => {
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
  }, [userState.userFid]);

  const fetchConnectedDevices = useCallback(async () => {
    try {
      setIsLoadingDevices(true);
      const response = await fetch(`/api/users/check-rook-connections?fid=${userState.userFid}`);
      const data = await response.json() as RookResponse;
      
      if (response.ok) {
        console.log('Respuesta de check-rook-connections:', data);
        
        // Si tenemos data_sources, usar esa lista
        if (data.data_sources && data.data_sources.length > 0) {
          const authorizedDevices = data.data_sources.map(source => ({
            data_source: source.charAt(0).toUpperCase() + source.slice(1).replace(/_/g, ' '),
            authorized: true
          }));
          console.log('Dispositivos autorizados desde data_sources:', authorizedDevices);
          setConnectedDevices(authorizedDevices);
        }
        // Si no, usar rook_authorized_sources
        else if (data.rook_authorized_sources) {
          const authorizedDevices = Object.entries(data.rook_authorized_sources)
            .filter(([, isConnected]) => isConnected)
            .map(([key]) => ({
              data_source: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
              authorized: true
            }));
          console.log('Dispositivos autorizados desde rook_authorized_sources:', authorizedDevices);
          setConnectedDevices(authorizedDevices);
        } else {
          console.log('No se encontraron dispositivos conectados');
          setConnectedDevices([]);
        }
      } else {
        console.error('Error fetching connected devices:', response.statusText);
        setConnectedDevices([]);
      }
    } catch (error) {
      console.error('Error fetching connected devices:', error);
      setConnectedDevices([]);
    } finally {
      setIsLoadingDevices(false);
    }
  }, [userState.userFid]);

  useEffect(() => {
    fetchUserGoals();
    fetchConnectedDevices();
  }, [fetchUserGoals, fetchConnectedDevices]);

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

  const handleRevokeDevice = async (deviceName: string) => {
    try {
      setIsRevoking(true);
      const response = await fetch('/api/users/revoke-rook-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userState.userFid,
          data_source: deviceName.toLowerCase()
        }),
      });

      if (response.ok) {
        console.log('✅ Dispositivo desconectado:', deviceName);
        // Actualizar la lista de dispositivos
        await fetchConnectedDevices();
      } else {
        console.error('❌ Error al desconectar dispositivo:', deviceName);
      }
    } catch (error) {
      console.error('Error revoking device:', error);
    } finally {
      setIsRevoking(false);
    }
  };

  const handleNavigation = (path: string) => {
    onClose(); // Close the control panel
    router.push(path); // Use Next.js router for internal navigation
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
          {/* profile picture del usuario */}
          <div className="flex justify-center items-center">
            {pfpUrl && (
              <Image 
                src={pfpUrl}
                alt={`${userState.username}'s profile`}
                width={150}
                height={150}
                className="rounded-full border-2 border-gray-700"
                unoptimized
              />
            )}
          </div>

          {/* New Navigation Rows */}
          <div className="space-y-2">
            <button 
              onClick={() => handleNavigation('/attestations')}
              className="w-full flex justify-between items-center py-2 border-b border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors"
            >
              <span className="text-gray-400">Attestations</span>
              <span className="text-white">→</span>
            </button>
            <button 
              onClick={() => handleNavigation('/challenges')}
              className="w-full flex justify-between items-center py-2 border-b border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors"
            >
              <span className="text-gray-400">Challenges</span>
              <span className="text-white">→</span>
            </button>
            <button 
              onClick={() => handleNavigation('/badges')}
              className="w-full flex justify-between items-center py-2 border-b border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors"
            >
              <span className="text-gray-400">Badges</span>
              <span className="text-white">→</span>
            </button>
            {/* Botón de Atest - Solo visible para usuarios autorizados */}
            {isAuthorizedForTesting(userState.userFid) && (
              <button 
                onClick={() => handleNavigation('/leaderboard')}
                className="w-full flex justify-between items-center py-2 border-b border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors"
              >
                <span className="text-gray-400">FC Leadeerboard</span>
                <span className="text-white">→</span>
              </button>
            )}
          </div>

          {/* Daily Goals Section */}
          <div className="py-2 border-b border-gray-700">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">Daily Goals</span>
              <button
                onClick={() => setShowGoalsModal(true)}
                className="text-violet-800 hover:text-violet-500 transition-colors text-sm flex items-center gap-1"
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

          {/* Connected Devices Section */}
          <div className="py-2 border-b border-gray-700">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">Connected Devices</span>
            </div>
            {isLoadingDevices ? (
              <div className="text-gray-500 text-sm">Loading devices...</div>
            ) : connectedDevices.length > 0 ? (
              <div className="space-y-2">
                {connectedDevices.map((device) => (
                  <div key={device.data_source} className="bg-gray-800 p-2 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-white">{device.data_source}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-500">Connected</span>
                      <button
                        onClick={() => handleRevokeDevice(device.data_source)}
                        disabled={isRevoking}
                        className="ml-2 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                      >
                        {isRevoking ? (
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 text-sm text-center py-2">
                No devices connected
              </div>
            )}
          </div>

          {/* Version Information */}
          <div className="text-center text-gray-500 text-sm mt-6">
            Version 0.12.3
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