import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

/**
 * Endpoint para sincronizar el estado de conexión entre nuestra aplicación y la API de Rook.
 * Este endpoint compara los datos en la API de Rook con nuestros datos locales
 * y actualiza el estado de conexión si es necesario.
 */
export async function GET(request: Request) {
  try {
    // Extraer el user_fid del query parameter
    const { searchParams } = new URL(request.url);
    const user_fid = searchParams.get('user_fid');

    if (!user_fid) {
      return NextResponse.json({ success: false, error: 'user_fid es requerido' }, { status: 400 });
    }

    console.log(`[API Rook Sync] Sincronizando estado de conexión para user_fid: ${user_fid}`);

    // 1. Obtener el rook_user_id desde nuestra base de datos
    let rookUserId: string;
    let currentDataSources: any = null;
    
    try {
      // Intentar primero obtener desde rook_connection (la nueva tabla)
      const connectionResult = await sql`
        SELECT id, rook_user_id, data_sources
        FROM rook_connection
        WHERE user_fid = ${user_fid}
        LIMIT 1
      `;

      if (connectionResult.length === 0 || !connectionResult[0].rook_user_id) {
        console.log(`[API Rook Sync] No se encontró en rook_connection, buscando en user_connections`);
        
        // Fallback a user_connections si no está en rook_connection
        const legacyResult = await sql`
          SELECT id, rook_user_id
          FROM user_connections
          WHERE user_fid = ${user_fid}
          LIMIT 1
        `;
        
        if (legacyResult.length === 0 || !legacyResult[0].rook_user_id) {
          console.log(`[API Rook Sync] No se encontró conexión con Rook para user_fid: ${user_fid}`);
          return NextResponse.json({ 
            success: false, 
            error: 'Usuario no conectado a Rook' 
          }, { status: 404 });
        }
        
        rookUserId = legacyResult[0].rook_user_id;
        console.log(`[API Rook Sync] Usando rook_user_id de tabla legacy: ${rookUserId}`);
        
        // Crear un registro en rook_connection para este usuario
        try {
          await sql`
            INSERT INTO rook_connection
              (user_fid, rook_user_id, connection_status, created_at, updated_at)
            VALUES
              (${user_fid}, ${rookUserId}, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (user_fid) DO NOTHING
          `;
          console.log(`[API Rook Sync] Creado registro en rook_connection para user_fid: ${user_fid}`);
        } catch (insertError) {
          console.error(`[API Rook Sync] Error creando registro en rook_connection:`, insertError);
          // Continuamos a pesar del error
        }
      } else {
        rookUserId = connectionResult[0].rook_user_id;
        
        // Guardar los datos actuales para compararlos después
        if (connectionResult[0].data_sources) {
          currentDataSources = connectionResult[0].data_sources;
        }
      }
    } catch (dbError) {
      console.error(`[API Rook Sync] Error consultando la base de datos:`, dbError);
      
      // Si no podemos consultar la base de datos, usamos user_fid directamente
      rookUserId = user_fid;
      console.log(`[API Rook Sync] Usando user_fid como rook_user_id alternativo: ${rookUserId}`);
    }

    // 2. Consultar a la API de Rook para obtener el estado actual de conexión
    const rookClientUuid = process.env.ROOK_CLIENT_UUID;
    const rookClientSecret = process.env.ROOK_CLIENT_SECRET;

    if (!rookClientUuid || !rookClientSecret) {
      console.error('[API Rook Sync] Falta configuración de Rook: client_uuid o client_secret no encontrados');
      return NextResponse.json(
        { success: false, error: 'Error en la configuración del servidor' },
        { status: 500 }
      );
    }

    // Añadir un timestamp para evitar caché
    const timestamp = new Date().getTime();
    
    try {
      console.log(`[API Rook Sync] Consultando estado de conexión en Rook para user_id: ${rookUserId}`);
      const rookResponse = await fetch(
        `https://api.rook-connect.review/api/v1/user_id/${rookUserId}/data_sources/authorized?_t=${timestamp}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${rookClientUuid}:${rookClientSecret}`).toString('base64')}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          signal: AbortSignal.timeout(5000) // 5 segundos de timeout
        }
      );

      if (!rookResponse.ok) {
        const errorText = await rookResponse.text();
        console.error(`[API Rook Sync] Error consultando la API de Rook: ${rookResponse.status} - ${errorText}`);
        return NextResponse.json(
          { success: false, error: `Error consultando la API de Rook: ${rookResponse.status}` },
          { status: rookResponse.status }
        );
      }

      const rookData = await rookResponse.json();
      console.log(`[API Rook Sync] Estado de conexión en Rook:`, rookData);

      // 3. Verificar si hay cambios y actualizar la base de datos
      let changesDetected = false;
      let updatedSources: { [key: string]: boolean } = {};
      
      // Verificar si la respuesta tiene la estructura esperada con el objeto "sources"
      if (rookData.sources && typeof rookData.sources === 'object') {
        // Crear el objeto de fuentes actualizadas
        Object.entries(rookData.sources).forEach(([source, isConnected]) => {
          updatedSources[source] = Boolean(isConnected);
        });
        
        // Determinar si hay cambios comparando con los datos actuales
        if (currentDataSources && currentDataSources.sources) {
          const currentSources = currentDataSources.sources;
          
          // Comparar cada fuente para detectar cambios
          Object.keys(updatedSources).forEach(source => {
            if (!currentSources.hasOwnProperty(source) || currentSources[source] !== updatedSources[source]) {
              changesDetected = true;
            }
          });
          
          Object.keys(currentSources).forEach(source => {
            if (!updatedSources.hasOwnProperty(source)) {
              changesDetected = true;
            }
          });
        } else {
          changesDetected = true; // Si no teníamos datos actuales, hay cambios
        }
        
        // Actualizar la base de datos con los nuevos datos
        try {
          const connectionStatus = Object.values(updatedSources).some(Boolean) ? 'active' : 'inactive';
          
          await sql`
            UPDATE rook_connection
            SET 
              data_sources = ${JSON.stringify(rookData)}::jsonb,
              connection_status = ${connectionStatus},
              last_sync_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE user_fid = ${user_fid}
          `;
          console.log(`[API Rook Sync] Actualizado data_sources en BD para user_fid: ${user_fid}`);
        } catch (updateError) {
          console.error(`[API Rook Sync] Error actualizando en BD:`, updateError);
          // Continuamos a pesar del error
        }
      }

      // 4. Devolver el estado actualizado
      return NextResponse.json({
        success: true,
        user_id: rookUserId,
        changes_detected: changesDetected,
        updated_sources: updatedSources
      });
      
    } catch (error) {
      console.error(`[API Rook Sync] Error en la sincronización:`, error);
      return NextResponse.json({ 
        success: false, 
        error: 'Error al sincronizar el estado de conexión' 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('[API Rook Sync] Error general:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
} 