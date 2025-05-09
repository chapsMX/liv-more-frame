import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// Inicializar conexión a la base de datos
const sql = neon(process.env.DATABASE_URL!);

/**
 * La función GET permite probar rápidamente si el webhook está configurado correctamente
 * También puede manejar casos donde Rook redirige al webhook en lugar del callback
 */
export async function GET(request: Request) {
  console.log('[Webhook] Recibiendo solicitud GET para prueba');
  console.log('[Webhook] URL completa:', request.url);
  
  // Extraer posible user_id y client_uuid del path
  const pathUserId = request.url.match(/user_id\/([^\/]+)/)?.[1];
  const clientUuid = request.url.match(/client_uuid\/([^\/]+)/)?.[1];
  
  // Verificar si tenemos los parámetros necesarios para guardar una conexión
  if (pathUserId && clientUuid && !isNaN(Number(pathUserId))) {
    // Parece que este es un intento de autorización que fue redirigido al webhook
    console.log(`[Webhook] Detectada posible autorización: user_id=${pathUserId}, client_uuid=${clientUuid}`);
    
    try {
      // Intentar guardar la conexión en la base de datos
      const userInfo = await sql`
        SELECT user_fid FROM whitelist_users
        WHERE id = ${pathUserId}
        LIMIT 1
      `;
      
      if (userInfo.length > 0) {
        const userFid = userInfo[0].user_fid;
        console.log(`[Webhook] Encontrado user_fid=${userFid} para id=${pathUserId}`);
        
        // Verificar si ya existe una conexión
        const existingConnection = await sql`
          SELECT id FROM user_connections
          WHERE user_fid = ${userFid}
          LIMIT 1
        `;
        
        if (existingConnection.length > 0) {
          // Actualizar la conexión existente
          await sql`
            UPDATE user_connections
            SET 
              provider = 'rook',
              rook_user_id = ${pathUserId},
              updated_at = CURRENT_TIMESTAMP
            WHERE user_fid = ${userFid}
          `;
        } else {
          // Crear una nueva conexión
          await sql`
            INSERT INTO user_connections
              (user_fid, provider, rook_user_id, created_at, updated_at)
            VALUES
              (${userFid}, 'rook', ${pathUserId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `;
        }
        
        // También actualizamos la tabla whitelist_users
        await sql`
          UPDATE whitelist_users
          SET connected_provider = 'rook'
          WHERE user_fid = ${userFid}
        `;
        
        console.log(`[Webhook] Conexión guardada para user_fid=${userFid}`);
        
        // Redirigir al dashboard con un mensaje de éxito
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        return NextResponse.redirect(new URL(`${baseUrl}/dashboard?connection=success`, request.url));
      }
    } catch (error) {
      console.error('[Webhook] Error guardando conexión:', error);
    }
  }
  
  // Respuesta normal para verificación del webhook
  return NextResponse.json({
    success: true,
    message: "Webhook endpoint específico configurado correctamente",
    params: {
      user_id: pathUserId || 'No detectado en el path',
      client_uuid: clientUuid || 'No detectado en el path'
    },
    path: request.url
  });
}

/**
 * Endpoint webhook para recibir datos de Rook
 * Este endpoint es llamado por Rook cuando hay nuevos datos disponibles
 */
export async function POST(request: Request) {
  console.log('[Webhook] Recibiendo datos de Rook...');
  console.log('[Webhook] URL completa:', request.url);
  console.log('[Webhook] Headers:', JSON.stringify(Object.fromEntries([...request.headers]), null, 2));
  
  try {
    // Obtener los datos enviados por Rook
    const data = await request.json();
    
    // Crear logs detallados para inspeccionar los datos recibidos
    console.log('[Webhook] Datos recibidos:', JSON.stringify(data, null, 2));
    
    // Extraer el user_id y client_uuid de la URL si está presente en el formato específico de Rook
    // El formato esperado de webhook según Rook es:
    // /api/rook/webhook/client_uuid/{client_uuid}/user_id/{user_id}
    const urlMatch = request.url.match(/user_id\/([^\/]+)/);
    const urlExtractedUserId = urlMatch ? urlMatch[1] : null;
    const clientUuidMatch = request.url.match(/client_uuid\/([^\/]+)/);
    const clientUuid = clientUuidMatch ? clientUuidMatch[1] : null;
    
    // Usar el user_id de la URL si está disponible, o el del cuerpo
    let userId = data.user_id;
    
    if (urlExtractedUserId && urlExtractedUserId !== '{user_id}') {
      console.log(`[Webhook] Usando user_id de la URL: ${urlExtractedUserId}`);
      userId = urlExtractedUserId;
    }
    
    if (!userId) {
      console.error('[Webhook] Falta user_id tanto en la URL como en el cuerpo');
      return NextResponse.json(
        { success: false, error: 'Falta user_id en la solicitud' },
        { status: 400 }
      );
    }
    
    // Intentamos determinar el tipo de datos: primero miramos type, luego data_structure
    let dataType = data.type || 'unknown';
    
    // Si no hay type pero hay data_structure, usamos eso
    if (dataType === 'unknown' && data.data_structure) {
      dataType = data.data_structure;
      console.log(`[Webhook] Usando data_structure como tipo: ${dataType}`);
    }
    
    // Detectar tipo de datos basado en la estructura
    if (dataType === 'unknown') {
      if (data.physical_health && data.physical_health.summary) {
        dataType = 'physical_summary';
        console.log('[Webhook] Tipo de datos detectado por estructura: physical_summary');
      } else if (data.sleep && data.sleep.summary) {
        dataType = 'sleep_summary';
        console.log('[Webhook] Tipo de datos detectado por estructura: sleep_summary');
      } else if (data.body && data.body.summary) {
        dataType = 'body_summary';
        console.log('[Webhook] Tipo de datos detectado por estructura: body_summary');
      }
    }
    
    // Procesar los datos según su tipo
    try {
      console.log(`[Webhook] Procesando datos de tipo ${dataType} para user_id ${userId}`);
      
      switch (dataType) {
        case 'sleep_summary':
          await processSleepData({...data, user_id: userId});
          break;
        case 'physical_summary':
          await processPhysicalData({...data, user_id: userId});
          break;
        case 'body_summary':
          await processBodyData({...data, user_id: userId});
          break;
        default:
          // Intentar procesar de todos modos basado en la estructura
          if (data.physical_health) {
            console.log('[Webhook] Intentando procesar como datos físicos basado en estructura');
            await processPhysicalData({...data, user_id: userId});
          } else if (data.sleep) {
            console.log('[Webhook] Intentando procesar como datos de sueño basado en estructura');
            await processSleepData({...data, user_id: userId});
          } else {
            // Registrar todos los datos recibidos para análisis posterior
            console.log(`[Webhook] Datos de tipo ${dataType} recibidos pero no procesados`);
            // Guardar los datos recibidos en la tabla de logs para análisis
            await logWebhookData(userId, dataType, {...data, user_id: userId});
          }
      }
      
      // Responder con éxito - Rook requiere un código 200, 201 o 202 para confirmar recepción
      return NextResponse.json({ 
        success: true,
        message: `Datos de tipo ${dataType} procesados correctamente`
      }, { status: 200 });
      
    } catch (processingError: any) {
      console.error(`[Webhook] Error procesando datos de tipo ${dataType}:`, processingError);
      // Aún así respondemos con éxito para que Rook no reintente el envío
      // pero guardamos el error en los logs
      await logWebhookData(userId, dataType, {...data, user_id: userId}, processingError.message || String(processingError));
      return NextResponse.json(
        { success: true, warning: `Error procesando datos: ${processingError.message || String(processingError)}` },
        { status: 200 }
      );
    }
    
  } catch (error) {
    console.error('[Webhook] Error general procesando el webhook:', error);
    // Rook requiere una respuesta exitosa incluso si hay error para evitar reintento
    return NextResponse.json(
      { success: true, warning: 'Error interno pero confirmando recepción' },
      { status: 200 }
    );
  }
}

/**
 * Procesa los datos de sueño recibidos de Rook
 */
async function processSleepData(data: any) {
  // Asegurarnos de que tenemos una fecha válida
  let { user_id, date, summary } = data;
  
  // Si no hay fecha, usar la fecha actual
  if (!date) {
    // Si hay campos metadata o datetime, intentar extraer la fecha de ahí
    if (data.sleep && 
        data.sleep.summary && 
        data.sleep.summary.metadata && 
        data.sleep.summary.metadata.datetime_string) {
      
      // Intentar extraer la fecha del datetime en formato ISO
      const datetime = data.sleep.summary.metadata.datetime_string;
      date = datetime.split('T')[0]; // Extrae YYYY-MM-DD de YYYY-MM-DDTHH:MM:SS.sssZ
      console.log(`[Webhook] Fecha extraída de metadata.datetime_string en datos de sueño: ${date}`);
    } else if (data.sleep_health && 
              data.sleep_health.summary && 
              data.sleep_health.summary.sleep_summary && 
              data.sleep_health.summary.sleep_summary.metadata && 
              data.sleep_health.summary.sleep_summary.metadata.datetime_string) {
      // Estructura alternativa para datos sleep_health
      const datetime = data.sleep_health.summary.sleep_summary.metadata.datetime_string;
      date = datetime.split('T')[0];
      console.log(`[Webhook] Fecha extraída de sleep_health.summary.sleep_summary.metadata: ${date}`);
    }
    
    // Si aún no tenemos fecha, usar la fecha actual
    if (!date) {
      date = new Date().toISOString().split('T')[0];
      console.log(`[Webhook] Usando fecha actual para datos de sueño: ${date}`);
    }
  }
  
  console.log(`[Webhook] Procesando datos de sueño para user_id ${user_id}, fecha ${date}`);
  
  // Verificar si el user_id es el id de whitelist_users (número) o el rook_user_id (string)
  let userFid;
  
  if (!isNaN(Number(user_id))) {
    // Si es numérico, primero intentamos buscar por whitelist_users.id
    const userResult = await sql`
      SELECT user_fid FROM whitelist_users
      WHERE id = ${user_id}
      LIMIT 1
    `;
    
    if (userResult.length > 0) {
      userFid = userResult[0].user_fid;
      console.log(`[Webhook] Encontrado user_fid ${userFid} para whitelist_users.id ${user_id}`);
    } else {
      userFid = await getUserFidFromRookId(user_id);
    }
  } else {
    // Si no es numérico, buscamos por rook_user_id
    userFid = await getUserFidFromRookId(user_id);
  }
  
  if (!userFid) {
    console.error(`[Webhook] No se encontró user_fid para user_id/rook_user_id: ${user_id}`);
    throw new Error(`Usuario no encontrado: ${user_id}`);
  }
  
  // Extraer el valor de horas de sueño de los datos de Rook
  let sleepHours = null;
  
  // 1. Primer intento: Extraer de la estructura estándar
  if (summary?.duration) {
    sleepHours = Math.round(summary.duration / 3600) / 10;
    console.log(`[Webhook] Horas de sueño extraídas de summary.duration: ${sleepHours}`);
  } 
  // 2. Segundo intento: Extraer de sleep_health.summary
  else if (data.sleep_health && 
          data.sleep_health.summary && 
          data.sleep_health.summary.sleep_summary && 
          data.sleep_health.summary.sleep_summary.duration && 
          data.sleep_health.summary.sleep_summary.duration.sleep_duration_seconds_int) {
    
    const seconds = data.sleep_health.summary.sleep_summary.duration.sleep_duration_seconds_int;
    sleepHours = Math.round(seconds / 360) / 10; // Convertir segundos a horas con un decimal
    console.log(`[Webhook] Horas de sueño extraídas de sleep_duration_seconds_int: ${sleepHours}`);
  }
  // 3. Tercer intento: Buscar en non_structured_data_array para Fitbit
  else if (data.sleep_health && 
          data.sleep_health.summary && 
          data.sleep_health.summary.sleep_summary && 
          data.sleep_health.summary.sleep_summary.non_structured_data_array) {
    
    const nonStructuredData = data.sleep_health.summary.sleep_summary.non_structured_data_array;
    
    // Recorrer el array buscando datos de Fitbit
    for (let i = 0; i < nonStructuredData.length; i++) {
      const item = nonStructuredData[i];
      
      // Verificar si es un objeto con datos de sueño de Fitbit
      if (item && typeof item === 'object') {
        // Fitbit puede tener minutesAsleep o duration
        if (item.minutesAsleep !== undefined) {
          // Convertir minutos a horas
          sleepHours = Math.round(item.minutesAsleep / 6) / 10;
          console.log(`[Webhook] Horas de sueño extraídas de non_structured_data_array[${i}].minutesAsleep: ${sleepHours}`);
          break;
        } else if (item.duration !== undefined) {
          // La duración suele estar en milisegundos
          sleepHours = Math.round(item.duration / 3600000) / 10;
          console.log(`[Webhook] Horas de sueño extraídas de non_structured_data_array[${i}].duration: ${sleepHours}`);
          break;
        }
      }
    }
  }
  
  console.log(`[Webhook] Datos de sueño extraídos: sleepHours=${sleepHours}, date=${date}`);
  
  if (sleepHours !== null) {
    // Actualizar o insertar en daily_activities
    try {
      // Consultar si existe un registro para esa fecha
      const existingRecord = await sql`
        SELECT id FROM daily_activities
        WHERE user_fid = ${userFid} AND date = ${date}
        LIMIT 1
      `;
      
      if (existingRecord.length > 0) {
        // Actualizar el registro existente
        await sql`
          UPDATE daily_activities
          SET sleep_hours = ${sleepHours}, updated_at = CURRENT_TIMESTAMP
          WHERE user_fid = ${userFid} AND date = ${date}
        `;
      } else {
        // Crear un nuevo registro
        console.log(`[Webhook] Insertando nuevo registro para sueño: user_fid=${userFid}, date=${date}, sleep_hours=${sleepHours}`);
        await sql`
          INSERT INTO daily_activities
            (user_fid, date, sleep_hours, created_at, updated_at)
          VALUES
            (${userFid}, ${date}, ${sleepHours}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
      }
      
      console.log(`[Webhook] Datos de sueño actualizados para user_fid: ${userFid}, fecha: ${date}, horas: ${sleepHours}`);
    } catch (dbError) {
      console.error('[Webhook] Error de base de datos guardando datos de sueño:', dbError);
      throw dbError;
    }
  } else {
    console.log(`[Webhook] No se encontraron datos válidos de sueño para user_fid: ${userFid}`);
  }
}

/**
 * Procesa los datos físicos (steps, calories) recibidos de Rook
 */
async function processPhysicalData(data: any) {
  // Asegurarnos de que tenemos una fecha válida
  let { user_id, date } = data;
  let { summary } = data;
  
  // Si no hay fecha, usar la fecha actual
  if (!date) {
    // Si hay campos metadata o datetime, intentar extraer la fecha de ahí
    if (data.physical_health && 
        data.physical_health.summary && 
        data.physical_health.summary.physical_summary && 
        data.physical_health.summary.physical_summary.metadata && 
        data.physical_health.summary.physical_summary.metadata.datetime_string) {
      
      // Intentar extraer la fecha del datetime en formato ISO
      const datetime = data.physical_health.summary.physical_summary.metadata.datetime_string;
      date = datetime.split('T')[0]; // Extrae YYYY-MM-DD de YYYY-MM-DDTHH:MM:SS.sssZ
      console.log(`[Webhook] Fecha extraída de metadata.datetime_string: ${date}`);
    } 
    // Alternativa para datos de Fitbit
    else if (data.physical_health && 
             data.physical_health.summary && 
             data.physical_health.summary.physical_summary && 
             data.physical_health.summary.physical_summary.non_structured_data_array) {
      
      const nonStructuredData = data.physical_health.summary.physical_summary.non_structured_data_array;
      
      // Buscar en el array no estructurado un objeto que tenga dateOfSleep o algún otro campo de fecha
      for (let i = 0; i < nonStructuredData.length; i++) {
        const item = nonStructuredData[i];
        if (item && typeof item === 'object') {
          if (item.dateOfSleep) {
            date = item.dateOfSleep;
            console.log(`[Webhook] Fecha extraída de non_structured_data_array[${i}].dateOfSleep: ${date}`);
            break;
          } else if (item.summary && item.summary.date) {
            date = item.summary.date;
            console.log(`[Webhook] Fecha extraída de non_structured_data_array[${i}].summary.date: ${date}`);
            break;
          }
        }
      }
    }
    
    // Si aún no tenemos fecha, usar la fecha actual
    if (!date) {
      date = new Date().toISOString().split('T')[0];
      console.log(`[Webhook] Usando fecha actual: ${date}`);
    }
  }
  
  console.log(`[Webhook] Procesando datos físicos para user_id ${user_id}, fecha ${date}`);
  
  // Intentar extraer el resumen de diferentes ubicaciones en el objeto
  if (!summary) {
    // Si no hay summary en el nivel superior, buscar en physical_health
    if (data.physical_health && data.physical_health.summary) {
      summary = data.physical_health.summary;
    }
    
    // Para datos Fitbit, a veces están en non_structured_data_array
    if ((!summary || !summary.steps) && 
        data.physical_health && 
        data.physical_health.summary && 
        data.physical_health.summary.physical_summary && 
        data.physical_health.summary.physical_summary.non_structured_data_array) {
      
      const nonStructuredData = data.physical_health.summary.physical_summary.non_structured_data_array;
      
      // Recorrer todo el array buscando datos útiles
      for (let i = 0; i < nonStructuredData.length; i++) {
        const item = nonStructuredData[i];
        if (item && typeof item === 'object') {
          if (item.summary) {
            console.log(`[Webhook] Encontrados datos en non_structured_data_array[${i}].summary`);
            summary = item.summary;
            break;
          }
        }
      }
    }
  }
  
  if (!summary) {
    console.log('[Webhook] No se pudo encontrar información de resumen en los datos');
    console.log('Datos completos:', JSON.stringify(data));
    throw new Error('Datos físicos no contienen resumen');
  }
  
  // Verificar si el user_id es el id de whitelist_users (número) o el rook_user_id (string)
  let userFid;
  
  if (!isNaN(Number(user_id))) {
    // Si es numérico, primero intentamos buscar por whitelist_users.id
    const userResult = await sql`
      SELECT user_fid FROM whitelist_users
      WHERE id = ${user_id}
      LIMIT 1
    `;
    
    if (userResult.length > 0) {
      userFid = userResult[0].user_fid;
      console.log(`[Webhook] Encontrado user_fid ${userFid} para whitelist_users.id ${user_id}`);
    } else {
      userFid = await getUserFidFromRookId(user_id);
    }
  } else {
    // Si no es numérico, buscamos por rook_user_id
    userFid = await getUserFidFromRookId(user_id);
  }
  
  if (!userFid) {
    console.error(`[Webhook] No se encontró user_fid para user_id/rook_user_id: ${user_id}`);
    throw new Error(`Usuario no encontrado: ${user_id}`);
  }
  
  // Extraer valores de pasos y calorías
  // Primero intentamos con la estructura estándar
  let steps = summary.steps || null;
  let calories = summary.active_calories || summary.caloriesOut || null;
  
  // En el caso de Fitbit, los pasos están directamente en summary.steps
  // Y las calorías activas podrían estar en diferentes ubicaciones
  if (calories === null && summary.activityCalories !== undefined) {
    calories = summary.activityCalories;
  }
  
  // Si no encontramos calorías activas, intentamos con calorías totales
  if (calories === null && summary.caloriesOut !== undefined) {
    calories = summary.caloriesOut;
  }
  
  // Verificar si hay datos en la estructura Fitbit específica
  if (data.physical_health?.summary?.physical_summary?.non_structured_data_array) {
    const nonStructuredData = data.physical_health.summary.physical_summary.non_structured_data_array;
    
    for (let i = 0; i < nonStructuredData.length; i++) {
      const item = nonStructuredData[i];
      
      if (item && typeof item === 'object') {
        // Extraer datos dependiendo de la estructura
        if (steps === null && item.summary && item.summary.steps !== undefined) {
          steps = item.summary.steps;
          console.log(`[Webhook] Pasos extraídos de non_structured_data_array[${i}].summary.steps: ${steps}`);
        }
        
        if (calories === null) {
          if (item.summary && item.summary.caloriesOut !== undefined) {
            calories = item.summary.caloriesOut;
            console.log(`[Webhook] Calorías extraídas de non_structured_data_array[${i}].summary.caloriesOut: ${calories}`);
          } else if (item.summary && item.summary.activityCalories !== undefined) {
            calories = item.summary.activityCalories;
            console.log(`[Webhook] Calorías extraídas de non_structured_data_array[${i}].summary.activityCalories: ${calories}`);
          }
        }
        
        // Si encontramos ambos datos, podemos salir del bucle
        if (steps !== null && calories !== null) {
          break;
        }
      }
    }
  }
  
  console.log(`[Webhook] Datos extraídos: steps=${steps}, calories=${calories}, date=${date}`);
  
  // Si hay datos, actualizar la base de datos
  if (steps !== null || calories !== null) {
    try {
      // Verificar si existe un registro para esa fecha
      const existingRecord = await sql`
        SELECT id FROM daily_activities
        WHERE user_fid = ${userFid} AND date = ${date}
        LIMIT 1
      `;
      
      if (existingRecord.length > 0) {
        // Actualizar el registro existente según los datos disponibles
        if (steps !== null && calories !== null) {
          await sql`
            UPDATE daily_activities
            SET steps = ${steps}, calories = ${calories}, updated_at = CURRENT_TIMESTAMP
            WHERE user_fid = ${userFid} AND date = ${date}
          `;
        } else if (steps !== null) {
          await sql`
            UPDATE daily_activities
            SET steps = ${steps}, updated_at = CURRENT_TIMESTAMP
            WHERE user_fid = ${userFid} AND date = ${date}
          `;
        } else if (calories !== null) {
          await sql`
            UPDATE daily_activities
            SET calories = ${calories}, updated_at = CURRENT_TIMESTAMP
            WHERE user_fid = ${userFid} AND date = ${date}
          `;
        }
      } else {
        // Crear un nuevo registro
        console.log(`[Webhook] Insertando nuevo registro: user_fid=${userFid}, date=${date}, steps=${steps || 0}, calories=${calories || 0}`);
        await sql`
          INSERT INTO daily_activities
            (user_fid, date, steps, calories, created_at, updated_at)
          VALUES
            (${userFid}, ${date}, ${steps || 0}, ${calories || 0}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
      }
      
      console.log(`[Webhook] Datos físicos actualizados para user_fid: ${userFid}, fecha: ${date}, steps: ${steps}, calories: ${calories}`);
    } catch (dbError) {
      console.error('[Webhook] Error de base de datos guardando datos físicos:', dbError);
      throw dbError;
    }
  } else {
    console.log(`[Webhook] No se encontraron datos válidos de pasos o calorías para user_fid: ${userFid}`);
  }
}

/**
 * Procesa los datos corporales recibidos de Rook
 */
async function processBodyData(data: any) {
  // Por ahora, simplemente registramos que se recibieron datos
  console.log('[Webhook] Datos corporales recibidos:', data);
  // Implementar en el futuro según necesidades
  await logWebhookData(data.user_id, 'body_summary', data);
}

/**
 * Obtiene el user_fid de nuestro sistema a partir del user_id de Rook
 */
async function getUserFidFromRookId(rookUserId: string): Promise<string | null> {
  try {
    // Buscar en la base de datos el user_fid asociado al rook_user_id
    const result = await sql`
      SELECT user_fid FROM user_connections 
      WHERE rook_user_id = ${rookUserId}
      LIMIT 1
    `;
    
    if (result.length > 0) {
      return result[0].user_fid;
    }
    
    return null;
  } catch (error) {
    console.error('[Webhook] Error buscando user_fid:', error);
    return null;
  }
}

/**
 * Registra los datos recibidos en el webhook para análisis posterior
 */
async function logWebhookData(userId: string, type: string, data: any, errorMessage?: string) {
  try {
    // Extraer la fecha de los datos si está disponible
    let dataDate = null;
    if (data.date) {
      dataDate = data.date;
    }
    
    // Verificar si ya existe un log para este documento
    const documentVersion = data.document_version || '1';
    
    try {
      // Primero verificamos si el registro ya existe
      const existingLog = await sql`
        SELECT id FROM processed_webhook_logs
        WHERE user_id = ${userId} 
          AND type = ${type}
          AND document_version = ${documentVersion}
        LIMIT 1
      `;
      
      if (existingLog.length > 0) {
        // Si ya existe, actualizamos
        console.log(`[Webhook] Actualizando log existente para usuario=${userId}, tipo=${type}, version=${documentVersion}`);
        await sql`
          UPDATE processed_webhook_logs
          SET 
            data_date = ${dataDate},
            webhook_status = ${errorMessage ? 'error' : 'success'},
            error_message = ${errorMessage || null},
            raw_payload = ${JSON.stringify(data)},
            processed_at = CURRENT_TIMESTAMP
          WHERE 
            user_id = ${userId} 
            AND type = ${type}
            AND document_version = ${documentVersion}
        `;
      } else {
        // Si no existe, intentamos insertar
        console.log(`[Webhook] No existe log previo, insertando nuevo registro para usuario=${userId}, tipo=${type}, version=${documentVersion}`);
        
        try {
          await sql`
            INSERT INTO processed_webhook_logs
              (user_id, type, data_date, document_version, webhook_status, error_message, raw_payload, processed_at)
            VALUES
              (${userId}, ${type}, ${dataDate}, ${documentVersion}, 
               ${errorMessage ? 'error' : 'success'}, ${errorMessage || null}, 
               ${JSON.stringify(data)}, CURRENT_TIMESTAMP)
          `;
        } catch (insertError: any) {
          // Si hay un error de clave duplicada, simplemente lo ignoramos
          // Esto puede ocurrir si otro proceso insertó el registro entre nuestra verificación y nuestra inserción
          if (insertError.code === '23505') { // Código PostgreSQL para violación de clave única
            console.log(`[Webhook] Registro duplicado detectado durante inserción: usuario=${userId}, tipo=${type}, version=${documentVersion}`);
            return true;
          }
          
          // Cualquier otro error lo propagamos
          throw insertError;
        }
      }
      
      console.log(`[Webhook] Datos registrados en logs: usuario=${userId}, tipo=${type}`);
      return true;
    } catch (sqlError) {
      console.error('[Webhook] Error SQL en logWebhookData:', sqlError);
      return false;
    }
  } catch (error) {
    console.error('[Webhook] Error registrando datos en logs:', error);
    return false;
  }
} 