import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Cache para almacenar mapeos de user_fid para reducir consultas a la base de datos
const userIdCache = new Map<string, { timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

/**
 * Endpoint para iniciar el proceso de conexión con un proveedor de Rook.
 * Este endpoint es llamado cuando un usuario hace clic en "Conectar" en la interfaz.
 * Genera una URL de autorización específica para el proveedor seleccionado.
 */
export async function POST(request: Request) {
  try {
    // Obtener el user_fid y provider del cuerpo de la solicitud
    const { user_fid, provider } = await request.json();
    
    console.log(`[API] Iniciando conexión con ${provider} para el usuario ${user_fid}`);
    
    if (!user_fid || !provider) {
      return NextResponse.json(
        { success: false, error: 'user_fid y provider son requeridos' },
        { status: 400 }
      );
    }
    
    // En una implementación real, aquí validaríamos que el usuario existe en nuestra base de datos
    
    // Construir la URL para la API de Rook para obtener la URL de autorización
    // Usamos variables de entorno para mantener las credenciales seguras
    const rookClientUuid = process.env.ROOK_CLIENT_UUID;
    const rookClientSecret = process.env.ROOK_CLIENT_SECRET;
    
    if (!rookClientUuid || !rookClientSecret) {
      console.error('[API] Falta configuración de Rook: client_uuid o client_secret no encontrados');
      return NextResponse.json(
        { success: false, error: 'Error en la configuración del servidor' },
        { status: 500 }
      );
    }
    
    try {
      // Aquí se hace la llamada a la API de Rook para obtener la URL de autorización
      // En este entorno de prueba, simulamos una respuesta exitosa
      
      // En producción, se llamaría a la API de Rook usando el endpoint de authorizers
      const rookResponse = await fetch(
        `https://api.rook-connect.review/v2/authorizers/${provider}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${rookClientUuid}:${rookClientSecret}`).toString('base64')}`,
          },
        }
      );
      
      const rookData = await rookResponse.json();
      
      if (!rookResponse.ok) {
        console.error(`[API] Error desde Rook API: ${JSON.stringify(rookData)}`);
        throw new Error(`Error desde Rook API: ${rookData.message || rookData.error || 'Desconocido'}`);
      }
      
      // Usar la URL de autorización proporcionada por Rook
      const authUrl = rookData.auth_url;
      
      if (!authUrl) {
        console.error('[API] La API de Rook no devolvió una URL de autorización válida');
        throw new Error('La API de Rook no devolvió una URL de autorización válida');
      }
      
      console.log(`[API] URL de autorización obtenida: ${authUrl}`);
      
      // Devolver la URL de autorización para que el frontend pueda abrir una ventana de autorización
      return NextResponse.json({
        success: true,
        url: authUrl
      });
      
    } catch (apiError) {
      console.error(`[API] Error llamando a la API de Rook:`, apiError);
      return NextResponse.json(
        { success: false, error: 'Error en la comunicación con Rook' },
        { status: 502 }
      );
    }
    
  } catch (error) {
    console.error(`[API] Error general en el endpoint de conexión:`, error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * Función de utilidad para generar una URL de autorización simulada para pruebas
 */
function generateSimulatedAuthUrl(provider: string, user_fid: string): string {
  // En producción, esta URL vendría directamente desde la API de Rook
  // Aquí generamos una URL simulada para el entorno de pruebas
  
  // Usamos una URL que apunte de vuelta a nuestro entorno de prueba
  // para simular la redirección después de que el usuario autoriza
  return `/rook-test/auth-simulator?provider=${provider}&user_fid=${user_fid}&mock=true`;
}

export async function GET(request: Request) {
  try {
    // Extraer el user_fid del query parameter
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');
    const fromFarcaster = searchParams.get('from_farcaster') === 'true';

    if (!user_fid) {
      return NextResponse.json({ error: 'user_fid es requerido' }, { status: 400 });
    }

    console.log(`[API Rook Connect] Procesando conexión para user_fid: ${user_fid}`);

    // Obtener client_uuid de las variables de entorno (necesario en cualquier caso)
    const rookClientUuid = process.env.ROOK_CLIENT_UUID;
    
    if (!rookClientUuid) {
      console.error('[API Rook Connect] ROOK_CLIENT_UUID no está configurado en variables de entorno');
      return NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 });
    }

    // Construir la URL de Rook Connections
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    console.log(`[API Rook Connect] Usando base URL: ${baseUrl}`);

    // Ahora usamos directamente user_fid como rook_user_id
    const rookUserId = user_fid;
    console.log(`[API Rook Connect] Usando user_fid ${user_fid} como rook_user_id`);
    
    // Crear la URL de callback que recibirá los parámetros después de la autorización
    const callbackUrl = `${baseUrl}/api/rook/callback-catchall/client_uuid/${rookClientUuid}/user_id/${rookUserId}${fromFarcaster ? '?from_farcaster=true' : ''}`;
    
    // También crear un webhook URL para que Rook envíe los datos
    const webhookUrl = `${baseUrl}/api/rook/webhook/client_uuid/${rookClientUuid}/user_id/${rookUserId}`;
    
    console.log(`[API Rook Connect] Callback URL: ${callbackUrl}`);
    console.log(`[API Rook Connect] Webhook URL: ${webhookUrl}`);
    
    // Construir la URL de Rook Connections
    let redirectUrl = new URL(`https://connections.rook-connect.review/client_uuid/${rookClientUuid}/user_id/${rookUserId}/`);
    
    // Si la solicitud viene de Farcaster, agregar un parámetro para indicar que se debe abrir en una nueva ventana
    if (fromFarcaster) {
      redirectUrl.searchParams.append('open_new_window', 'true');
    }
    
    console.log(`[API Rook Connect] Redirigiendo a: ${redirectUrl.toString()}`);

    // Intentamos registrar la conexión en la tabla rook_connection
    try {
      // Verificar si ya existe una conexión en rook_connection
      const existingConnection = await sql`
        SELECT id FROM rook_connection
        WHERE user_fid = ${user_fid}
        LIMIT 1
      `;

      if (existingConnection.length > 0) {
        // Actualizar la conexión existente
        await sql`
          UPDATE rook_connection
          SET 
            rook_user_id = ${rookUserId.toString()},
            connection_status = 'active',
            updated_at = CURRENT_TIMESTAMP
          WHERE user_fid = ${user_fid}
        `;
        console.log(`[API Rook Connect] Actualizada conexión existente para user_fid: ${user_fid}`);
      } else {
        // Crear una nueva conexión en rook_connection
        await sql`
          INSERT INTO rook_connection
            (user_fid, rook_user_id, connection_status, created_at, updated_at)
          VALUES
            (${user_fid}, ${rookUserId.toString()}, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
        console.log(`[API Rook Connect] Creada nueva conexión para user_fid: ${user_fid}`);
      }

      // También mantener actualizada la tabla user_connections para compatibilidad
      const existingLegacyConnection = await sql`
        SELECT id FROM user_connections
        WHERE user_fid = ${user_fid}
        LIMIT 1
      `;

      if (existingLegacyConnection.length > 0) {
        await sql`
          UPDATE user_connections
          SET 
            provider = 'rook',
            rook_user_id = ${rookUserId.toString()},
            updated_at = CURRENT_TIMESTAMP
          WHERE user_fid = ${user_fid}
        `;
      } else {
        await sql`
          INSERT INTO user_connections
            (user_fid, provider, rook_user_id, created_at, updated_at)
          VALUES
            (${user_fid}, 'rook', ${rookUserId.toString()}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
      }

      console.log(`[API Rook Connect] Preparado registro de conexión para user_fid: ${user_fid} con rook_user_id: ${rookUserId}`);
    } catch (dbError) {
      console.error('[API Rook Connect] Error preparando registro de conexión:', dbError);
      // Continuar a pesar del error, lo más importante es la redirección
    }

    // Redirigir al usuario a la página de Rook Connections
    return NextResponse.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('[API Rook Connect] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
} 