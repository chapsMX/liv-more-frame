import { NextResponse } from 'next/server';

/**
 * Configura automáticamente el webhook en Rook usando la URL base y el formato correcto
 */
export async function GET(request: Request) {
  try {
    // Obtener la URL base, ya sea de environment variables o del host actual
    const { host } = new URL(request.url);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${host}`;
    
    // Obtener credenciales de Rook desde variables de entorno
    const rookClientUuid = process.env.ROOK_CLIENT_UUID;
    const rookClientSecret = process.env.ROOK_CLIENT_SECRET;
    
    if (!rookClientUuid || !rookClientSecret) {
      console.error('[Webhook Setup] Faltan credenciales de Rook en variables de entorno');
      return NextResponse.json(
        { success: false, error: 'Error de configuración del servidor' },
        { status: 500 }
      );
    }
    
    console.log(`[Webhook Setup] Usando URL base: ${baseUrl}`);
    
    // Construir la URL del webhook con el formato que Rook parece estar esperando
    // Hay dos opciones posibles para la URL del webhook:
    const simplifiedWebhookUrl = `${baseUrl}/api/rook/webhook`;
    const patternedWebhookUrl = `${baseUrl}/api/rook/webhook-catchall/client_uuid/${rookClientUuid}/user_id/{user_id}`;
    
    // Usaremos la URL simple por defecto, ya que es más estándar
    const webhookUrl = simplifiedWebhookUrl;
    console.log(`[Webhook Setup] Configurando webhook URL: ${webhookUrl}`);
    
    // Construir credenciales para la autenticación
    const credentials = Buffer.from(`${rookClientUuid}:${rookClientSecret}`).toString('base64');
    
    // Lista de posibles endpoints para configurar el webhook en Rook
    const possibleEndpoints = [
      'https://api.rook-connect.review/api/v1/webhooks',
      'https://api.rook-connect.review/user_events/subscribe',
      'https://api.rook-connect.review/v2/user_events/subscribe',
      'https://api.rook-connect.review/subscription/webhook',
      'https://api.rook-connect.review/api/v1/subscription/webhook',
      'https://api.rook-connect.review/api/v1/user_events/subscribe'
    ];
    
    // Intentar cada endpoint hasta que uno funcione
    let successfulEndpoint = null;
    let responseData = null;
    
    for (const endpoint of possibleEndpoints) {
      try {
        console.log(`[Webhook Setup] Intentando configurar webhook usando: ${endpoint}`);
        
        const requestBody = JSON.stringify({ url: webhookUrl });
        console.log(`[Webhook Setup] Cuerpo de la solicitud: ${requestBody}`);
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json'
          },
          body: requestBody
        });
        
        const responseStatus = response.status;
        console.log(`[Webhook Setup] Código de estado de respuesta: ${responseStatus}`);
        
        const responseText = await response.text();
        console.log(`[Webhook Setup] Respuesta completa: ${responseText}`);
        
        if (response.ok) {
          try {
            responseData = JSON.parse(responseText);
            successfulEndpoint = endpoint;
            console.log(`[Webhook Setup] Webhook configurado con éxito usando: ${endpoint}`);
            break;
          } catch (parseError) {
            console.log(`[Webhook Setup] Respuesta no es JSON, pero status code es OK. Endpoint: ${endpoint}`);
            responseData = { message: responseText };
            successfulEndpoint = endpoint;
            break;
          }
        } else {
          console.log(`[Webhook Setup] Falló configuración en: ${endpoint}`);
        }
      } catch (error) {
        console.error(`[Webhook Setup] Error intentando ${endpoint}:`, error);
      }
    }
    
    if (successfulEndpoint) {
      return NextResponse.json({
        success: true,
        message: `Webhook configurado correctamente usando ${successfulEndpoint}`,
        webhookUrl,
        data: responseData
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Ninguno de los endpoints de configuración de webhook funcionó',
        tried: possibleEndpoints
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('[Webhook Setup] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 