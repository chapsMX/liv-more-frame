import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

interface RookMetadata {
  datetime_string: string;
  sources_of_data_array: string[];
  user_id_string: string;
}

interface PhysicalSummary {
  distance?: {
    steps_int: number;
    distance_meters_float: number;
  };
  calories?: {
    calories_expenditure_kcal_float: number;
  };
  metadata?: RookMetadata;
}

interface SleepSummary {
  duration?: {
    sleep_duration_seconds_int: number;
  };
  metadata?: RookMetadata;
}

interface RookWebhookData {
  user_id: string;
  date?: string;
  physical_health?: {
    summary?: {
      physical_summary: PhysicalSummary;
    };
  };
  sleep_health?: {
    summary?: {
      sleep_summary: SleepSummary;
    };
  };
}

interface DailyActivityData {
  steps?: number;
  calories?: number;
  distance_meters?: number;
  sleep_hours?: number;
}

/**
 * Endpoint para verificar que el webhook está configurado correctamente
 */
export async function GET(request: Request) {
  console.log('🔍 [Webhook] Recibiendo solicitud GET para prueba');
  console.log('📡 [Webhook] URL completa:', request.url);
  
  return NextResponse.json({
    success: true,
    message: "Webhook endpoint configurado correctamente",
    timestamp: new Date().toISOString(),
    request_url: request.url
  });
}

/**
 * Endpoint principal del webhook para recibir datos de Rook
 */
export async function POST(request: Request) {
  console.log('📥 [Webhook] Recibiendo datos de Rook...');
  console.log('📡 [Webhook] URL completa:', request.url);
  console.log('🔑 [Webhook] Headers:', JSON.stringify(Object.fromEntries([...request.headers]), null, 2));
  
  try {
    const data = await request.json() as RookWebhookData;
    console.log('📦 [Webhook] Datos recibidos:', JSON.stringify(data, null, 2));

    // Extraer el user_id
    const user_id = data.user_id;
    if (!user_id) {
      console.error('❌ [Webhook] Falta user_id en los datos');
      return NextResponse.json(
        { success: false, error: 'Missing user_id' },
        { status: 400 }
      );
    }

    // Determinar el tipo de datos recibidos
    let dataType = 'unknown';
    if (data.physical_health?.summary) {
      dataType = 'physical_summary';
    } else if (data.sleep_health?.summary) {
      dataType = 'sleep_summary';
    }

    console.log('🏷️ [Webhook] Tipo de datos identificado:', dataType);

    // Procesar los datos según su tipo
    try {
      switch (dataType) {
        case 'physical_summary':
          await processPhysicalData(data);
          break;
        case 'sleep_summary':
          await processSleepData(data);
          break;
        default:
          console.log('⚠️ [Webhook] Tipo de datos no reconocido:', dataType);
          // Guardar los datos sin procesar para análisis posterior
          await logWebhookData(user_id, dataType, data);
      }

      return NextResponse.json({ 
        success: true,
        message: `Datos de tipo ${dataType} procesados correctamente en v2_daily_activities`
      });

    } catch (processingError) {
      const errorMessage = processingError instanceof Error ? processingError.message : 'Unknown error';
      console.error('❌ [Webhook] Error procesando datos:', errorMessage);
      await logWebhookData(user_id, dataType, data, errorMessage);
      
      // Retornamos 200 para que Rook no reintente el envío
      return NextResponse.json({
        success: true,
        warning: `Error interno procesando datos: ${errorMessage}`
      });
    }

  } catch (error) {
    console.error('❌ [Webhook] Error general:', error);
    return NextResponse.json({
      success: true,
      warning: 'Error interno procesando la solicitud'
    });
  }
}

/**
 * Procesa los datos físicos recibidos
 */
async function processPhysicalData(data: RookWebhookData) {
  const { user_id } = data;
  const activityDate = extractDate(data);
  
  // Extraer datos del resumen físico
  const physicalSummary = data.physical_health?.summary?.physical_summary;
  const steps = physicalSummary?.distance?.steps_int || 0;
  const calories = physicalSummary?.calories?.calories_expenditure_kcal_float || 0;
  const distance = physicalSummary?.distance?.distance_meters_float || 0;

  // Obtener el user_fid asociado
  const userFid = await getUserFidFromRookId(user_id);
  if (!userFid) {
    throw new Error(`No se encontró user_fid para user_id: ${user_id}`);
  }

  // Extraer data source del metadata
  const dataSource = physicalSummary?.metadata?.sources_of_data_array?.[0] || 'unknown';

  // Actualizar v2_daily_activities
  await updateDailyActivityV2(userFid, activityDate, {
    steps,
    calories,
    distance_meters: Math.round(distance)
  }, dataSource, user_id, physicalSummary?.metadata);

  // Sincronizar challenges activos para este usuario
  await syncUserChallenges(userFid, activityDate);
}

/**
 * Procesa los datos de sueño recibidos
 */
async function processSleepData(data: RookWebhookData) {
  const { user_id } = data;
  const activityDate = extractDate(data);
  
  // Extraer datos del resumen de sueño
  const sleepSummary = data.sleep_health?.summary?.sleep_summary;
  const sleepDurationSeconds = sleepSummary?.duration?.sleep_duration_seconds_int || 0;
  const sleepDurationHours = Math.round((sleepDurationSeconds / 3600) * 10) / 10;

  // Obtener el user_fid asociado
  const userFid = await getUserFidFromRookId(user_id);
  if (!userFid) {
    throw new Error(`No se encontró user_fid para user_id: ${user_id}`);
  }

  // Extraer data source del metadata
  const dataSource = sleepSummary?.metadata?.sources_of_data_array?.[0] || 'unknown';

  // Actualizar v2_daily_activities
  await updateDailyActivityV2(userFid, activityDate, {
    sleep_hours: sleepDurationHours
  }, dataSource, user_id, sleepSummary?.metadata);

  // Sincronizar challenges activos para este usuario
  await syncUserChallenges(userFid, activityDate);
}

/**
 * Extrae la fecha de los datos recibidos (lógica simple como en el webhook viejo)
 */
function extractDate(data: RookWebhookData): string {
  // Intentar obtener la fecha de diferentes ubicaciones en los datos
  let date = data.date;
  
  if (!date) {
    // Buscar en metadata de resumen físico
    const physicalMetadata = data.physical_health?.summary?.physical_summary?.metadata;
    if (physicalMetadata?.datetime_string) {
      date = physicalMetadata.datetime_string.split('T')[0];
    }
    // Buscar en metadata de resumen de sueño
    const sleepMetadata = data.sleep_health?.summary?.sleep_summary?.metadata;
    if (!date && sleepMetadata?.datetime_string) {
      date = sleepMetadata.datetime_string.split('T')[0];
    }
  }

  // Si aún no hay fecha, usar la fecha actual
  if (!date) {
    date = new Date().toISOString().split('T')[0];
  }

  return date;
}

/**
 * Obtiene el user_fid asociado a un user_id de Rook
 */
async function getUserFidFromRookId(rookUserId: string): Promise<string | null> {
  try {
    const result = await sql`
      SELECT user_fid 
      FROM rook_connection 
      WHERE rook_user_id = ${rookUserId}
      LIMIT 1
    `;
    
    return result.length > 0 ? result[0].user_fid : null;
  } catch (error) {
    console.error('❌ [Webhook] Error buscando user_fid:', error);
    return null;
  }
}

/**
 * Actualiza o crea un registro en v2_daily_activities
 */
async function updateDailyActivityV2(
  userFid: string, 
  activityDate: string, 
  data: DailyActivityData,
  dataSource?: string,
  rookUserId?: string,
  metadata?: any
) {
  try {
    const processingDate = new Date().toISOString().split('T')[0];
    
    console.log('📝 [Webhook] Updating v2_daily_activities:', {
      userFid,
      activityDate,
      processingDate,
      data,
      dataSource
    });

    // Verificar si existe un registro para esa activity_date
    const existingRecord = await sql`
      SELECT id FROM v2_daily_activities
      WHERE user_fid = ${userFid} AND activity_date = ${activityDate}
      LIMIT 1
    `;

    if (existingRecord.length > 0) {
      // Actualizar registro existente
      if ('steps' in data || 'calories' in data || 'distance_meters' in data) {
        await sql`
          UPDATE v2_daily_activities
          SET 
            steps = COALESCE(${data.steps}, steps),
            calories = COALESCE(${data.calories}, calories),
            distance_meters = COALESCE(${data.distance_meters}, distance_meters),
            processing_date = ${processingDate},
            data_source = COALESCE(${dataSource}, data_source),
            rook_user_id = COALESCE(${rookUserId}, rook_user_id),
            webhook_metadata = COALESCE(${metadata ? JSON.stringify(metadata) : null}::jsonb, webhook_metadata),
            updated_at = CURRENT_TIMESTAMP
          WHERE user_fid = ${userFid} AND activity_date = ${activityDate}
        `;
      } else if ('sleep_hours' in data) {
        await sql`
          UPDATE v2_daily_activities
          SET 
            sleep_hours = ${data.sleep_hours},
            processing_date = ${processingDate},
            data_source = COALESCE(${dataSource}, data_source),
            rook_user_id = COALESCE(${rookUserId}, rook_user_id),
            webhook_metadata = COALESCE(${metadata ? JSON.stringify(metadata) : null}::jsonb, webhook_metadata),
            updated_at = CURRENT_TIMESTAMP
          WHERE user_fid = ${userFid} AND activity_date = ${activityDate}
        `;
      }
      
      console.log('✅ [Webhook] Record updated successfully');
    } else {
      // Crear nuevo registro
      if ('steps' in data || 'calories' in data || 'distance_meters' in data) {
        await sql`
          INSERT INTO v2_daily_activities (
            user_fid,
            activity_date,
            processing_date,
            steps,
            calories,
            distance_meters,
            data_source,
            rook_user_id,
            webhook_metadata,
            created_at,
            updated_at
          ) VALUES (
            ${userFid},
            ${activityDate},
            ${processingDate},
            ${data.steps || 0},
            ${data.calories || 0},
            ${data.distance_meters || 0},
            ${dataSource},
            ${rookUserId},
            ${metadata ? JSON.stringify(metadata) : null}::jsonb,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `;
      } else if ('sleep_hours' in data) {
        await sql`
          INSERT INTO v2_daily_activities (
            user_fid,
            activity_date,
            processing_date,
            sleep_hours,
            data_source,
            rook_user_id,
            webhook_metadata,
            created_at,
            updated_at
          ) VALUES (
            ${userFid},
            ${activityDate},
            ${processingDate},
            ${data.sleep_hours || 0},
            ${dataSource},
            ${rookUserId},
            ${metadata ? JSON.stringify(metadata) : null}::jsonb,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `;
      }
      
      console.log('✅ [Webhook] New record created successfully');
    }
  } catch (error) {
    console.error('❌ [Webhook] Error updating v2_daily_activities:', error);
    throw error;
  }
}

/**
 * Sincroniza challenges activos para un usuario específico
 */
async function syncUserChallenges(userFid: string, date: string) {
  try {
    console.log('🎯 [Webhook] Syncing challenges for user:', userFid, 'date:', date);
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/challenges/sync-daily`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        date,
        user_fid: userFid 
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ [Webhook] Challenge sync completed:', result);
    } else {
      console.error('❌ [Webhook] Error syncing challenges:', await response.text());
    }
  } catch (error) {
    console.error('❌ [Webhook] Error calling challenge sync:', error);
  }
}

/**
 * Registra los datos recibidos para análisis posterior
 */
async function logWebhookData(userId: string, type: string, data: RookWebhookData, errorMessage?: string) {
  try {
    const date = extractDate(data);
    
    await sql`
      INSERT INTO webhook_logs
        (user_id, type, data_date, raw_data, error_message, created_at)
      VALUES
        (${userId}, ${type}, ${date}, ${JSON.stringify(data)}, ${errorMessage}, CURRENT_TIMESTAMP)
    `;
  } catch (error) {
    console.error('❌ [Webhook] Error guardando log:', error);
  }
} 