"use client";

import { useState, useEffect } from 'react';
import { protoMono } from '../styles/fonts';

export default function WebhookConfig() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error' | 'info'} | null>(null);

  // Obtener la URL actual del webhook
  useEffect(() => {
    const fetchCurrentWebhook = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/rook/webhook');
        const data = await response.json();
        
        if (data.success && data.webhookUrl) {
          setCurrentUrl(data.webhookUrl);
          setWebhookUrl(data.webhookUrl);
        } else {
          setMessage({
            text: 'No hay URL de webhook configurada actualmente',
            type: 'info'
          });
        }
      } catch (error) {
        console.error('Error obteniendo webhook:', error);
        setMessage({
          text: 'Error obteniendo la configuración actual',
          type: 'error'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrentWebhook();
  }, []);

  // Función para guardar la URL del webhook
  const handleSaveWebhook = async () => {
    try {
      setIsLoading(true);
      setMessage(null);
      
      // Validar la URL
      if (!webhookUrl || !webhookUrl.startsWith('https://')) {
        setMessage({
          text: 'La URL debe comenzar con https://',
          type: 'error'
        });
        setIsLoading(false);
        return;
      }
      
      // Enviar la configuración al servidor
      const response = await fetch('/api/rook/webhook', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ webhookUrl })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCurrentUrl(webhookUrl);
        setMessage({
          text: 'Webhook configurado correctamente',
          type: 'success'
        });
      } else {
        setMessage({
          text: data.error || 'Error configurando el webhook',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error guardando webhook:', error);
      setMessage({
        text: 'Error al guardar la configuración',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 p-6 rounded-xl shadow-lg max-w-2xl mx-auto">
      <h2 className={`text-xl font-semibold mb-4 text-white ${protoMono.className}`}>Configuración de Webhook</h2>
      
      {/* Estado actual */}
      <div className="mb-4">
        <h3 className={`text-md mb-2 text-gray-300 ${protoMono.className}`}>Estado actual:</h3>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-violet-500"></div>
          </div>
        ) : currentUrl ? (
          <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
            <p className={`text-green-400 text-sm ${protoMono.className}`}>
              URL configurada: <span className="text-gray-300 break-all">{currentUrl}</span>
            </p>
          </div>
        ) : (
          <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
            <p className={`text-yellow-400 text-sm ${protoMono.className}`}>
              No hay URL de webhook configurada
            </p>
          </div>
        )}
      </div>
      
      {/* Formulario */}
      <div className="mb-4">
        <label className={`block text-gray-300 mb-2 ${protoMono.className}`}>
          URL del Webhook:
        </label>
        <input 
          type="text" 
          value={webhookUrl} 
          onChange={(e) => setWebhookUrl(e.target.value)} 
          placeholder="https://tu-dominio.com/api/webhook"
          className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
        <p className={`mt-1 text-xs text-gray-400 ${protoMono.className}`}>
          La URL debe comenzar con https:// y ser accesible públicamente
        </p>
      </div>
      
      {/* Mensaje de estado */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg ${
          message.type === 'success' ? 'bg-green-900/30 border border-green-800 text-green-400' :
          message.type === 'error' ? 'bg-red-900/30 border border-red-800 text-red-400' :
          'bg-blue-900/30 border border-blue-800 text-blue-400'
        }`}>
          <p className={`text-sm ${protoMono.className}`}>{message.text}</p>
        </div>
      )}
      
      {/* Botón de guardar */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveWebhook}
          disabled={isLoading}
          className={`px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors text-white ${protoMono.className}`}
        >
          {isLoading ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
      
      {/* Instrucciones */}
      <div className="mt-6 p-3 bg-gray-800 rounded-lg border border-gray-700">
        <h3 className={`text-md mb-2 text-gray-300 ${protoMono.className}`}>Instrucciones:</h3>
        <ol className={`list-decimal list-inside space-y-2 text-gray-400 text-sm ${protoMono.className}`}>
          <li>La URL del webhook debe ser accesible públicamente.</li>
          <li>Debe responder con códigos 200, 201 o 202 cuando recibe datos.</li>
          <li>No requiere encabezados de autorización.</li>
          <li>Rook enviará actualizaciones automáticamente cuando haya nuevos datos disponibles.</li>
        </ol>
        
        <div className="mt-4 p-3 bg-blue-900/30 border border-blue-800 rounded-lg">
          <p className={`text-blue-400 text-sm font-semibold mb-2 ${protoMono.className}`}>Nota importante sobre el formato de URL:</p>
          <p className={`text-gray-400 text-sm ${protoMono.className}`}>
            La URL correcta para el webhook debe ser simplemente: 
            <span className="bg-gray-900 px-2 py-1 mx-1 rounded">https://dominio.com/api/rook/webhook</span>
          </p>
          <p className={`text-gray-400 text-sm mt-2 ${protoMono.className}`}>
            Hemos implementado un manejador catch-all que también acepta URLs con formatos como:
            <span className="block bg-gray-900 px-2 py-1 my-1 rounded text-xs break-all">/api/rook/webhook/client_uuid/{'{client_uuid}'}/user_id/{'{user_id}'}</span>
            para manejar posibles cambios en la implementación de Rook.
          </p>
        </div>
      </div>
    </div>
  );
} 