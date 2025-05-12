"use client";

import { useEffect, useState, useCallback } from 'react';
import { protoMono } from '../styles/fonts';
import { Button } from './Button';
import { rookService } from '../services/rook';

interface ControlPanelProps {
  onClose: () => void;
  userFid: string;
}

interface GoalsState {
  calories: number;
  steps: number;
  sleep: number;
}

interface RookConnection {
  data_source: string;
  authorized: boolean;
}

// Mapeo de nombres legibles para las fuentes de datos
const dataSourceLabels: Record<string, string> = {
  'garmin': 'Garmin',
  'oura': 'Oura Ring',
  'polar': 'Polar',
  'fitbit': 'Fitbit',
  'withings': 'Withings',
  'whoop': 'Whoop',
  'dexcom': 'Dexcom',
  'apple_health': 'Apple Health',
  'google_fit': 'Google Fit',
  'health_connect': 'Health Connect',
  'android': 'Android'
};

// Colores para cada proveedor
const dataSourceColors: Record<string, string> = {
  'garmin': 'border-blue-600',
  'oura': 'border-purple-600',
  'polar': 'border-red-600',
  'fitbit': 'border-blue-500',
  'withings': 'border-gray-600',
  'whoop': 'border-gray-900',
  'dexcom': 'border-blue-900',
  'apple_health': 'border-gray-500',
  'google_fit': 'border-green-600',
  'health_connect': 'border-teal-600',
  'android': 'border-green-700'
};

export default function ControlPanel({ onClose, userFid }: ControlPanelProps) {
  const [rookConnections, setRookConnections] = useState<RookConnection[]>([]);
  const [hasActiveConnections, setHasActiveConnections] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Estados para los menús acordeón
  const [isGoalsOpen, setIsGoalsOpen] = useState(false);
  const [isConnectionsOpen, setIsConnectionsOpen] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  
  const [goals, setGoals] = useState<GoalsState>({
    calories: 500,
    steps: 10000,
    sleep: 8
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Obtener todas las fuentes de datos conectadas
  const fetchConnectedSources = useCallback(async () => {
    setIsLoading(true);
    setConnectionError(null);
    
    try {
      // Obtener un timestamp para evitar caché
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/rook/data-sources-authorized?user_fid=${userFid}&_t=${timestamp}&force_refresh=true`);
      
      if (!response.ok) {
        throw new Error('Error fetching connection status');
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        let connections: RookConnection[] = [];
        
        // Verificar la estructura de la respuesta
        if (result.data.sources && typeof result.data.sources === 'object') {
          // Transformar el objeto sources en un array de todas las fuentes
          connections = Object.entries(result.data.sources)
            .map(([key, value]) => ({
              data_source: key,
              authorized: Boolean(value)
            }));
          
          // Verificar si hay al menos una conexión activa
          const activeConnections = connections.filter(conn => conn.authorized);
          setHasActiveConnections(activeConnections.length > 0);
          
          // Para la visualización, mostrar solo las conexiones activas
          connections = activeConnections;
        }
        
        console.log('Conexiones activas:', connections);
        setRookConnections(connections);
      } else {
        console.error('Error en la respuesta:', result.error);
        setConnectionError(result.error || 'Error obteniendo fuentes conectadas');
        setRookConnections([]);
        setHasActiveConnections(false);
      }
    } catch (error) {
      console.error('Error fetching connected sources:', error);
      setConnectionError('Error de conexión al servidor');
      setRookConnections([]);
      setHasActiveConnections(false);
    } finally {
      setIsLoading(false);
    }
  }, [userFid]);
  
  // Función para obtener los objetivos actuales del usuario
  const fetchUserGoals = useCallback(async () => {
    try {
      const response = await fetch(`/api/goals/get?user_fid=${userFid}`);
      const data = await response.json();
      
      if (data.success && data.goals) {
        setGoals({
          calories: data.goals.calories_goal || 500,
          steps: data.goals.steps_goal || 10000,
          sleep: data.goals.sleep_hours_goal || 8
        });
      }
    } catch (error) {
      console.error('Error fetching user goals:', error);
    }
  }, [userFid]);

  useEffect(() => {
    fetchUserGoals();
    fetchConnectedSources();
  }, [fetchUserGoals, fetchConnectedSources]);

  // Función para revocar una conexión específica
  const handleRevokeConnection = async (dataSource: string) => {
    if (!userFid || !dataSource) {
      console.log('[Rook Revoke] Missing userFid or dataSource:', { userFid, dataSource });
      return;
    }
    
    console.log(`[Rook Revoke] Iniciando revocación para user_fid: ${userFid}, fuente: ${dataSource}`);
    setRevoking(dataSource);
    setConnectionError(null);
    
    try {
      // Llamar directamente a la API de Rook para revocar la conexión
      console.log('[Rook Revoke] Llamando a rookService.revokeConnection');
      const result = await rookService.revokeConnection(userFid, dataSource);
      
      if (result.success) {
        console.log(`[Rook Revoke] Conexión con ${dataSource} revocada correctamente`);
        
        // Actualizar el estado local
        setRookConnections(prev => {
          const updated = prev.filter(conn => conn.data_source !== dataSource);
          console.log('[Rook Revoke] Estado local actualizado:', updated);
          return updated;
        });
        
        // Si era la última conexión, actualizar el estado de conexiones activas
        if (rookConnections.length <= 1) {
          console.log('[Rook Revoke] Última conexión revocada, actualizando estado');
          setHasActiveConnections(false);
        }
        
        // Obtener el estado actualizado de las conexiones después de un breve retraso
        setTimeout(async () => {
          try {
            console.log('[Rook Revoke] Obteniendo estado actualizado de conexiones');
            const updatedSources = await rookService.getConnectedSources(userFid);
            
            if (updatedSources) {
              console.log('[Rook Revoke] Fuentes actualizadas recibidas:', updatedSources);
              // Actualizar el estado con las fuentes conectadas actuales
              const activeConnections = Object.entries(updatedSources)
                .filter(([_, value]) => Boolean(value))
                .map(([key]) => ({
                  data_source: key,
                  authorized: true
                }));
              
              console.log('[Rook Revoke] Conexiones activas actualizadas:', activeConnections);
              setRookConnections(activeConnections);
              setHasActiveConnections(activeConnections.length > 0);
            }
          } catch (updateError) {
            console.error('[Rook Revoke] Error actualizando las conexiones:', updateError);
            // No mostrar este error al usuario ya que la revocación fue exitosa
          }
        }, 1000);
      } else {
        throw new Error(result.error || 'Error desconocido al revocar la conexión');
      }
    } catch (err) {
      let errorMessage = 'Error desconocido al revocar la conexión';
      
      if (err instanceof Error) {
        console.error('[Rook Revoke] Error completo:', {
          name: err.name,
          message: err.message,
          stack: err.stack
        });
        errorMessage = err.message;
      } else {
        console.error('[Rook Revoke] Error no estándar:', err);
      }
      
      setConnectionError(`Error al revocar la conexión: ${errorMessage}`);
    } finally {
      setRevoking(null);
    }
  };

  // Función para abrir la página de conexiones de Rook
  const handleOpenRookConnections = () => {
    // Detectar si estamos en un iframe (posiblemente Farcaster)
    const isInIframe = window !== window.parent;
    
    if (isInIframe) {
      // Si estamos en un iframe, abrir en una nueva ventana
      window.open(`/api/rook/connect?user_fid=${userFid}&from_farcaster=true`, '_blank');
    } else {
      // En caso contrario, redirigir normalmente
      window.location.href = `/api/rook/connect?user_fid=${userFid}`;
    }
  };
  
  // Función para guardar los objetivos
  const handleSaveGoals = async () => {
    try {
      const response = await fetch('/api/goals/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_fid: userFid,
          calories_goal: goals.calories,
          steps_goal: goals.steps,
          sleep_hours_goal: goals.sleep
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Mostrar mensaje de éxito
        setShowSuccessMessage(true);
        
        // Ocultar mensaje después de 3 segundos
        setTimeout(() => {
          setShowSuccessMessage(false);
          // Cerrar el acordeón
          setIsGoalsOpen(false);
        }, 3000);
      }
    } catch (error) {
      console.error('Error saving goals:', error);
    }
  };
  
  // Manejadores para actualizar los valores de objetivos
  const handleGoalChange = (type: keyof GoalsState, value: string) => {
    const numValue = parseInt(value, 10);
    
    if (!isNaN(numValue)) {
      setGoals(prev => ({
        ...prev,
        [type]: type === 'sleep' ? Math.min(24, Math.max(0, numValue)) : Math.max(0, numValue)
      }));
    }
  };

  const handleConnectRook = useCallback(() => {
    window.open('https://connect.tryrook.io/', '_blank');
  }, []);

  const handleConnectAppleHealth = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);
      // For now, we'll use a hardcoded user ID. In a real app, this would come from your auth system
      const userId = 'test-user-1';
      await rookService.connectAppleHealth(userId);
    } catch (err) {
      console.error('Error connecting to Apple Health:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to Apple Health');
    } finally {
      setIsConnecting(false);
    }
  }, []);

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
            <h3 className={`text-xl font-bold text-center mb-4 ${protoMono.className}`}>Connect your wearable</h3>
            <div className="space-y-2">
              {/* Rook Connect - Acordeón */}
              <div className="rounded-xl overflow-hidden">
                {/* Cabecera del acordeón (siempre visible) */}
                <div className="flex items-center justify-between p-3 bg-gray-800">
                  <span className={protoMono.className}>Rook Connect</span>
                  <button 
                    onClick={() => setIsConnectionsOpen(!isConnectionsOpen)}
                    className={`p-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-center border-2 border-orange-500 ${protoMono.className}`}
                  >
                    <span className="text-white text-sm">
                      {isConnectionsOpen ? 'Close' : 'Manage'}
                    </span>
                  </button>
                </div>
                
                {/* Contenido del acordeón (visible solo cuando está abierto) */}
                {isConnectionsOpen && (
                  <div className="p-4 bg-gray-750 border-t border-gray-700">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                        <span className="ml-2 text-gray-400">Cargando conexiones...</span>
                      </div>
                    ) : connectionError ? (
                      <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 mb-4">
                        <p className="text-red-400 text-sm">{connectionError}</p>
                        <button
                          onClick={fetchConnectedSources}
                          className="mt-2 px-3 py-1 bg-gray-800 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                        >
                          Reintentar
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {rookConnections.length > 0 ? (
                          <div className="space-y-3">
                            <h4 className="text-sm text-gray-400 font-medium mb-2">Dispositivos conectados</h4>
                            
                            {rookConnections.map((connection) => (
                              <div 
                                key={connection.data_source}
                                className={`p-3 bg-gray-800 border-l-4 ${dataSourceColors[connection.data_source] || 'border-gray-700'} rounded-lg flex justify-between items-center`}
                              >
                                <div>
                                  <span className="font-medium text-white">
                                    {dataSourceLabels[connection.data_source] || connection.data_source}
                                  </span>
                                </div>
                                <button 
                                  onClick={() => handleRevokeConnection(connection.data_source)}
                                  disabled={revoking === connection.data_source}
                                  className={`px-3 py-1.5 rounded text-sm ${
                                    revoking === connection.data_source
                                      ? 'bg-gray-700 cursor-not-allowed'
                                      : 'bg-red-900/50 hover:bg-red-900 text-red-200'
                                  } transition-colors`}
                                >
                                  {revoking === connection.data_source ? (
                                    <span className="flex items-center">
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                                      Desconectando...
                                    </span>
                                  ) : 'Desconectar'}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-3">
                            <p className="text-gray-400 mb-3">No hay dispositivos conectados</p>
                          </div>
                        )}
                        
                        <div className="pt-3 border-t border-gray-700">
                          <button
                            onClick={handleOpenRookConnections}
                            className="w-full p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-white"
                          >
                            {hasActiveConnections ? 'Añadir otro dispositivo' : 'Conectar dispositivo'}
                          </button>
                          <p className="text-xs text-gray-500 mt-2 text-center">
                            Te redirigiremos a la página de Rook para gestionar tus conexiones
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Apple Health Connect */}
              <div className="rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-3 bg-gray-800">
                  <span className={protoMono.className}>Apple Health</span>
                  <button 
                    onClick={handleConnectAppleHealth}
                    className={`p-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-center border-2 border-green-500 ${protoMono.className}`}
                  >
                    <span className="text-white text-sm">Connect</span>
                  </button>
                </div>
                <div className="p-2 bg-gray-750">
                  <p className="text-xs text-gray-400">
                    Connect with Apple Health to sync your health and fitness data
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Sección de Objetivos */}
          <section className="bg-gray-900 p-3 rounded-2xl border border-gray-800">
            <h3 className={`text-xl font-bold text-center mb-4 ${protoMono.className}`}>Daily Goals</h3>
            <div className="space-y-2">
              <div className="rounded-xl overflow-hidden">
                {/* Cabecera del acordeón (siempre visible) */}
                <div className="flex items-center justify-between p-3 bg-gray-800">
                  <span className={protoMono.className}>Update Goals</span>
                  <button 
                    onClick={() => setIsGoalsOpen(!isGoalsOpen)}
                    className={`p-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-center border-2 border-orange-500 ${protoMono.className}`}
                  >
                    <span className="text-white text-sm">
                      {isGoalsOpen ? 'Close' : 'Modify'}
                    </span>
                  </button>
                </div>
                
                {/* Contenido del acordeón (visible solo cuando está abierto) */}
                {isGoalsOpen && (
                  <div className="p-4 bg-gray-750 border-t border-gray-700">
                    {/* Mensaje de éxito */}
                    {showSuccessMessage && (
                      <div className="mb-4 p-2 bg-green-900/30 border border-green-800 rounded-lg text-center">
                        <p className="text-green-400 text-sm">Goals updated successfully!</p>
                      </div>
                    )}
                    
                    <div className="space-y-4">
                      {/* Calorías */}
                      <div className="flex flex-col">
                        <label className="text-sm text-gray-400 mb-1">Calories (kcal)</label>
                        <input
                          type="number"
                          value={goals.calories}
                          onChange={(e) => handleGoalChange('calories', e.target.value)}
                          className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                          min="0"
                        />
                      </div>
                      
                      {/* Pasos */}
                      <div className="flex flex-col">
                        <label className="text-sm text-gray-400 mb-1">Steps</label>
                        <input
                          type="number"
                          value={goals.steps}
                          onChange={(e) => handleGoalChange('steps', e.target.value)}
                          className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                          min="0"
                        />
                      </div>
                      
                      {/* Sueño */}
                      <div className="flex flex-col">
                        <label className="text-sm text-gray-400 mb-1">Sleep Hours</label>
                        <input
                          type="number"
                          value={goals.sleep}
                          onChange={(e) => handleGoalChange('sleep', e.target.value)}
                          className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                          min="0"
                          max="24"
                        />
                      </div>
                      
                      {/* Botón de guardar */}
                      <button
                        onClick={handleSaveGoals}
                        className="w-full p-2 bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors text-white"
                      >
                        Save Goals
                      </button>
                    </div>
                  </div>
                )}
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