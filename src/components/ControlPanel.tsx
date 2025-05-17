"use client";

import { useEffect, useState } from 'react';
import { protoMono } from '../styles/fonts';
import { useUser } from '../context/UserContext';
import DGModal from './DGModal';
import { validateGoals } from '@/constants/goals';
import { useRouter } from 'next/navigation';

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
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const [goalsValidation, setGoalsValidation] = useState<ReturnType<typeof validateGoals> | null>(null);
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(true);
  const [isRevoking, setIsRevoking] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchUserGoals();
    fetchConnectedDevices();
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

  const fetchConnectedDevices = async () => {
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
            .filter(([_, value]) => value === true)
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

            {/* Connected Devices Section */}
            <div className="py-2 border-b border-gray-700">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400">Connected Devices</span>
{/*                 <button
                  onClick={() => router.push('/connect-device')}
                  className="text-violet-400 hover:text-violet-300 transition-colors text-sm flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Device
                </button> */}
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
          </div>

          {/* Opciones */}
          <div className="space-y-2">
            <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Help
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