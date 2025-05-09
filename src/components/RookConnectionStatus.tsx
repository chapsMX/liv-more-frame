"use client";

import { useState, useEffect } from 'react';
import { protoMono } from '../styles/fonts';

interface DataSource {
  data_source: string;
  authorized: boolean;
  last_sync?: string;
}

interface RookConnectionStatusProps {
  userFid: string;
  onStatusChange?: () => void;
}

export default function RookConnectionStatus({ userFid, onStatusChange }: RookConnectionStatusProps) {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Definimos los nombres legibles para las fuentes de datos
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
    'garmin': 'bg-blue-600',
    'oura': 'bg-purple-600',
    'polar': 'bg-red-600',
    'fitbit': 'bg-blue-500',
    'withings': 'bg-gray-700',
    'whoop': 'bg-black',
    'dexcom': 'bg-blue-900',
    'apple_health': 'bg-gray-800',
    'google_fit': 'bg-green-600',
    'health_connect': 'bg-teal-600',
    'android': 'bg-green-700'
  };

  const fetchDataSources = async (isRetry = false) => {
    if (!userFid) return;
    
    if (isRetry) {
      setRetrying(true);
    } else {
      setLoading(true);
    }
    
    setError(null);
    
    try {
      // Agregar un parámetro de timestamp para evitar caché de navegador
      // y force_refresh=true para forzar una actualización completa desde la API de Rook
      const timestamp = new Date().getTime();
      console.log(`[RookConnectionStatus] Consultando fuentes para user_fid: ${userFid}${isRetry ? ' (forzando actualización)' : ''}`);
      const response = await fetch(`/api/rook/data-sources-authorized?user_fid=${userFid}&_t=${timestamp}${isRetry ? '&force_refresh=true' : ''}`);
      
      if (!response.ok) {
        let errorMessage = 'Error obteniendo fuentes de datos';
        
        // Intentar obtener un mensaje de error más específico
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {}
        
        if (response.status === 503 || response.status === 504) {
          errorMessage = 'Problema de conexión con la base de datos. Por favor, inténtelo de nuevo en unos momentos.';
        }
        
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      
      // Mostrar información detallada en la consola para debugging
      console.log('========================');
      console.log(`[RookConnectionStatus] Respuesta completa para user_fid ${userFid}:`);
      console.log(JSON.stringify(result, null, 2));
      console.log('========================');
      
      if (result.success && result.data) {
        // Mostrar la estructura específica de la respuesta para debug
        console.log(`[RookConnectionStatus] Estructura de datos recibida:`);
        if (result.data.sources) {
          console.log('- Formato: result.data.sources');
          console.log(result.data.sources);
        } else if (result.data.data_sources) {
          console.log('- Formato: result.data.data_sources');
          console.log(result.data.data_sources);
        } else {
          console.log('- Estructura desconocida:');
          console.log(result.data);
        }
        
        // Transformar los datos según la estructura recibida
        let sources: DataSource[] = [];
        
        // Verificar si la respuesta tiene la estructura esperada con el objeto "sources"
        if (result.data.sources && typeof result.data.sources === 'object') {
          // Transformar el objeto sources en un array de objetos DataSource
          sources = Object.entries(result.data.sources).map(([key, value]) => ({
            data_source: key,
            authorized: Boolean(value)
          }));
        } 
        // Formato alternativo: si hay un array de data_sources
        else if (Array.isArray(result.data.data_sources)) {
          sources = result.data.data_sources.map((source: string) => ({
            data_source: source,
            authorized: true
          }));
        } 
        // Otro formato alternativo: si hay un objeto data_sources con true/false
        else if (result.data.data_sources && typeof result.data.data_sources === 'object') {
          sources = Object.entries(result.data.data_sources).map(([key, value]) => ({
            data_source: key,
            authorized: Boolean(value)
          }));
        }
        
        console.log(`[RookConnectionStatus] Fuentes de datos procesadas:`, sources);
        setDataSources(sources);
        
        // Si había un error previo y ahora tenemos éxito, limpiamos el error
        if (error) {
          setError(null);
        }
        
        // Si los datos provienen de la caché y están marcados como obsoletos, 
        // mostrar un mensaje informativo pero no un error bloqueante
        if (result.stale) {
          setError('Los datos pueden no estar actualizados debido a un problema de conectividad temporal.');
        }
      } else {
        console.error('Error obteniendo fuentes de datos:', result.error);
        setError(result.error || 'Error obteniendo fuentes de datos');
        // Mantenemos los datos anteriores si los hay
        if (dataSources.length === 0) {
          setDataSources([]);
        }
      }
    } catch (err: any) {
      console.error('Error en la petición:', err);
      setError(err.message || 'Error de conexión');
      // Mantenemos los datos anteriores si los hay
      if (dataSources.length === 0) {
        setDataSources([]);
      }
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  };

  const revokeDataSource = async (dataSource: string) => {
    if (!userFid || !dataSource) return;
    
    setRevoking(dataSource);
    setError(null);
    
    try {
      console.log(`[RookConnectionStatus] Iniciando revocación para user_fid: ${userFid}, data_source: ${dataSource}`);
      const response = await fetch('/api/rook/revoke-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_fid: userFid,
          data_source: dataSource
        }),
      });
      
      // Mostrar información sobre la respuesta
      console.log(`[RookConnectionStatus] Respuesta de revocación: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        let errorMessage = `Error al desconectar ${dataSourceLabels[dataSource] || dataSource}`;
        
        try {
          const errorData = await response.json();
          console.log('[RookConnectionStatus] Error en la respuesta:', errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.log('[RookConnectionStatus] No se pudo parsear la respuesta como JSON');
          try {
            const textResponse = await response.text();
            console.log('[RookConnectionStatus] Respuesta como texto:', textResponse);
          } catch {}
        }
        
        if (response.status === 503 || response.status === 504) {
          errorMessage = 'Problema de conexión con la base de datos. La desconexión se procesará cuando se restablezca la conexión.';
        }
        
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      console.log('[RookConnectionStatus] Resultado de revocación:', result);
      
      if (result.success) {
        console.log(`Conexión con ${dataSource} revocada correctamente`);
        
        // Actualizar el estado de la fuente de datos
        setDataSources(prevSources => 
          prevSources.map(source => 
            source.data_source === dataSource 
              ? { ...source, authorized: false } 
              : source
          )
        );
        
        // Notificar al componente padre si es necesario, pero sin causar loops
        if (onStatusChange) {
          console.log('[RookConnectionStatus] Notificando cambio explícito (revocación) al componente padre');
          // Llamamos al callback después de un breve retraso para evitar problemas de rendering
          setTimeout(() => {
            onStatusChange();
          }, 500);
        }
        
        // Forzar una reconsulta después de un breve retraso para sincronizar con el servidor
        setTimeout(() => {
          console.log('[RookConnectionStatus] Reconsultando datos después de revocar conexión');
          fetchDataSources(true);
        }, 2000);
        
      } else {
        console.error(`Error revocando conexión con ${dataSource}:`, result.error);
        setError(`Error al desconectar ${dataSourceLabels[dataSource] || dataSource}: ${result.error}`);
      }
    } catch (err: any) {
      console.error('Error en la petición:', err);
      setError(err.message || `Error al desconectar ${dataSourceLabels[dataSource] || dataSource}`);
    } finally {
      setRevoking(null);
    }
  };

  // Función para sincronizar con la página de conexiones de Rook
  const syncWithRook = async () => {
    if (!userFid) return;
    
    setSyncing(true);
    setError(null);
    
    try {
      console.log(`[RookConnectionStatus] Sincronizando con página de Rook para user_fid: ${userFid}`);
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/rook/sync-connection-status?user_fid=${userFid}&_t=${timestamp}`);
      
      if (!response.ok) {
        let errorMessage = 'Error sincronizando con Rook';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {}
        
        if (response.status === 503 || response.status === 504) {
          errorMessage = 'Problema de conexión con la base de datos. Por favor, inténtelo de nuevo en unos momentos.';
        }
        
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      console.log(`[RookConnectionStatus] Resultado de sincronización:`, result);
      
      if (result.success) {
        if (result.changes_detected && result.updated_sources) {
          console.log(`[RookConnectionStatus] Cambios detectados, actualizando estado local`);
          
          // Convertir el objeto de fuentes actualizadas a nuestro formato
          const updatedSources = Object.entries(result.updated_sources).map(([key, value]) => ({
            data_source: key,
            authorized: Boolean(value)
          }));
          
          setDataSources(updatedSources);
          
          // Notificar al componente padre si es necesario, pero evitar loops
          if (onStatusChange) {
            console.log('[RookConnectionStatus] Notificando cambio explícito (sincronización) al componente padre');
            // Usar setTimeout para evitar problemas de rendering
            setTimeout(() => {
              onStatusChange();
            }, 500);
          }
        } else {
          console.log(`[RookConnectionStatus] No se detectaron cambios`);
          
          // De todas formas, forzamos una actualización completa
          await fetchDataSources(true);
        }
      } else {
        console.error(`Error en la sincronización:`, result.error);
        setError(`Error al sincronizar: ${result.error}`);
      }
    } catch (err: any) {
      console.error('Error en la petición de sincronización:', err);
      setError(err.message || 'Error de sincronización');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      if (!isMounted) return;
      await fetchDataSources();
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [userFid]);

  if (loading && dataSources.length === 0) {
    return (
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg mb-4">
        <h3 className={`text-lg font-semibold mb-3 ${protoMono.className}`}>
          Conexiones de Wearables
        </h3>
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-400">Cargando conexiones...</span>
        </div>
      </div>
    );
  }

  if (error && dataSources.length === 0) {
    return (
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg mb-4">
        <h3 className={`text-lg font-semibold mb-3 ${protoMono.className}`}>
          Conexiones de Wearables
        </h3>
        <div className="text-center py-3">
          <div className="bg-red-900/30 border border-red-800 rounded p-3 mb-4">
            <p className="text-red-400 mb-2">{error}</p>
            <p className="text-gray-400 text-sm">
              No se pudieron cargar las conexiones. Puede ser debido a un problema temporal de conectividad.
            </p>
          </div>
          <button 
            onClick={() => fetchDataSources(true)}
            disabled={retrying}
            className={`px-4 py-2 ${retrying ? 'bg-gray-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded transition-colors`}
          >
            {retrying ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Reintentando...
              </span>
            ) : 'Reintentar'}
          </button>
        </div>
      </div>
    );
  }

  // Contar cuántos dispositivos están conectados
  const connectedCount = dataSources.filter(source => source.authorized).length;

  return (
    <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg mb-4">
      <h3 className={`text-lg font-semibold mb-3 ${protoMono.className}`}>
        Conexiones de Wearables
      </h3>
      
      {dataSources.length === 0 ? (
        <div className="text-center py-3">
          <p className="text-gray-400 mb-3">No hay información de dispositivos</p>
          <button 
            onClick={() => window.location.href = `/api/rook/connect?user_fid=${userFid}`}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Conectar Dispositivo
          </button>
        </div>
      ) : (
        <>
          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded p-2 mb-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          
          {loading && (
            <div className="bg-blue-900/30 border border-blue-800 rounded p-2 mb-3 flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-300 mr-2"></div>
              <p className="text-blue-400 text-sm">Actualizando...</p>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dataSources.map((source) => (
              <div 
                key={source.data_source}
                className={`border ${source.authorized ? 'border-gray-700' : 'border-gray-800 opacity-70'} rounded-lg p-3 flex flex-col`}
              >
                <div className="flex items-center mb-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${dataSourceColors[source.data_source] || 'bg-gray-700'} ${!source.authorized && 'opacity-50'}`}>
                    <span className="text-white font-bold text-sm">
                      {(dataSourceLabels[source.data_source] || source.data_source).substring(0, 1)}
                    </span>
                  </div>
                  <div className="ml-3">
                    <h4 className="font-semibold text-white">
                      {dataSourceLabels[source.data_source] || source.data_source}
                    </h4>
                    {source.authorized ? (
                      <span className="text-xs text-green-400 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Conectado
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        No conectado
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="mt-auto">
                  {source.authorized ? (
                    <button 
                      onClick={() => revokeDataSource(source.data_source)}
                      disabled={revoking === source.data_source}
                      className={`w-full mt-2 py-1.5 rounded text-sm 
                        ${revoking === source.data_source 
                          ? 'bg-gray-700 cursor-not-allowed' 
                          : 'bg-red-900/50 hover:bg-red-900 text-red-200'
                        } transition-colors`}
                    >
                      {revoking === source.data_source ? (
                        <span className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Desconectando...
                        </span>
                      ) : 'Desconectar'}
                    </button>
                  ) : (
                    <button 
                      onClick={() => window.location.href = `/api/rook/connect?user_fid=${userFid}`}
                      className="w-full mt-2 py-1.5 rounded text-sm bg-blue-900/50 hover:bg-blue-900 text-blue-200 transition-colors"
                    >
                      Conectar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 border-t border-gray-800 pt-3 flex justify-between items-center">
            <div className="text-xs text-gray-500">
              {connectedCount} dispositivo{connectedCount !== 1 ? 's' : ''} conectado{connectedCount !== 1 ? 's' : ''}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => syncWithRook()}
                disabled={loading || retrying || syncing}
                className={`px-3 py-1 ${loading || retrying || syncing ? 'bg-gray-800 cursor-not-allowed' : 'bg-purple-700 hover:bg-purple-600'} text-white text-sm rounded transition-colors`}
                title="Sincronizar con la página de conexiones de Rook"
              >
                {syncing ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                    Sincronizando...
                  </span>
                ) : 'Sincronizar'}
              </button>
              <button
                onClick={() => fetchDataSources(true)}
                disabled={loading || retrying || syncing}
                className={`px-3 py-1 ${loading || retrying || syncing ? 'bg-gray-800 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600'} text-white text-sm rounded transition-colors`}
              >
                {retrying ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                    Actualizando...
                  </span>
                ) : 'Refrescar'}
              </button>
              <button 
                onClick={() => window.location.href = `/api/rook/connect?user_fid=${userFid}`}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                Añadir Dispositivo
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 