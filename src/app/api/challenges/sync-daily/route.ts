import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const { date, user_fid } = await request.json();
    
    // Si no se proporciona fecha, usar hoy
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    console.log('🔄 [Sync Daily] Starting daily sync for date:', targetDate);
    
    // Obtener challenges activos (dentro del período de duración)
    const activeChallenges = await sql`
      SELECT 
        id, title, activity_type, duration_days, start_date
      FROM challenges
      WHERE 
        visible = true
        AND start_date <= ${targetDate}
        AND DATE(start_date) + INTERVAL '1 day' * duration_days > ${targetDate}
    `;
    
    console.log(`📋 [Sync Daily] Found ${activeChallenges.length} active challenges`);
    
    let totalSynced = 0;
    let totalUpdated = 0;
    
    for (const challenge of activeChallenges) {
      console.log(`🎯 [Sync Daily] Processing challenge: ${challenge.title} (ID: ${challenge.id})`);
      
      // Obtener participantes del challenge
      let participants;
      if (user_fid) {
        // Solo sincronizar para un usuario específico
        participants = await sql`
          SELECT user_fid
          FROM challenge_participants 
          WHERE challenge_id = ${challenge.id} AND user_fid = ${user_fid}
        `;
      } else {
        // Sincronizar para todos los participantes
        participants = await sql`
          SELECT user_fid
          FROM challenge_participants 
          WHERE challenge_id = ${challenge.id}
        `;
      }
      
      console.log(`👥 [Sync Daily] Challenge ${challenge.id} has ${participants.length} participants`);
      
      for (const participant of participants) {
        try {
          // Verificar si ya existe registro para esta fecha
          const existingRecord = await sql`
            SELECT id FROM challenge_daily_activity
            WHERE challenge_id = ${challenge.id} 
              AND user_fid = ${participant.user_fid} 
              AND date = ${targetDate}
          `;
          
          if (existingRecord.length > 0) {
            console.log(`⚠️ [Sync Daily] Record already exists for user ${participant.user_fid}, challenge ${challenge.id}, date ${targetDate}`);
            continue;
          }
          
          // Obtener rook_user_id del participante
          const rookConnection = await sql`
            SELECT rook_user_id 
            FROM rook_connection 
            WHERE user_fid = ${participant.user_fid}
          `;
          
          if (rookConnection.length === 0 || !rookConnection[0].rook_user_id) {
            console.log(`⚠️ [Sync Daily] No rook_user_id found for user ${participant.user_fid}`);
            continue;
          }
          
          const rookUserId = rookConnection[0].rook_user_id;
          
          // Obtener datos de actividad de las APIs existentes
          const [physicalRes, sleepRes] = await Promise.all([
            fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/users/physical-summary?user_id=${rookUserId}&date=${targetDate}`),
            fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/users/sleep-summary?user_id=${rookUserId}&date=${targetDate}`)
          ]);
          
          const physicalData = await physicalRes.json();
          const sleepData = await sleepRes.json();
          
          // Insertar registro de actividad diaria
          await sql`
            INSERT INTO challenge_daily_activity (
              challenge_id, 
              user_fid, 
              date, 
              steps, 
              calories, 
              sleep_hours
            )
            VALUES (
              ${challenge.id},
              ${participant.user_fid},
              ${targetDate},
              ${physicalData.steps || 0},
              ${physicalData.calories || 0},
              ${sleepData.sleep_duration_hours || 0}
            )
          `;
          
          totalSynced++;
          console.log(`✅ [Sync Daily] Synced data for user ${participant.user_fid}, challenge ${challenge.id}`);
          
        } catch (error) {
          console.error(`❌ [Sync Daily] Error syncing user ${participant.user_fid}, challenge ${challenge.id}:`, error);
        }
      }
      
      // Después de sincronizar la actividad, calcular progreso para este challenge
      if (participants.length > 0) {
        try {
          const progressRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/challenges/calculate-progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              challenge_id: challenge.id,
              user_fid: user_fid || undefined // Solo para usuario específico si se proporciona
            })
          });
          
          if (progressRes.ok) {
            const progressData = await progressRes.json();
            totalUpdated += progressData.summary.total_participants;
            console.log(`📊 [Sync Daily] Updated progress for challenge ${challenge.id}: ${progressData.summary.completed}/${progressData.summary.total_participants} completed`);
          } else {
            console.error(`❌ [Sync Daily] Error calculating progress for challenge ${challenge.id}`);
          }
        } catch (error) {
          console.error(`❌ [Sync Daily] Error calling progress calculation for challenge ${challenge.id}:`, error);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      date: targetDate,
      active_challenges: activeChallenges.length,
      total_records_synced: totalSynced,
      total_participants_updated: totalUpdated,
      user_fid: user_fid || 'all'
    });
    
  } catch (error) {
    console.error('❌ [Sync Daily] Error in daily sync:', error);
    return NextResponse.json(
      { error: 'Failed to sync daily challenge activity' },
      { status: 500 }
    );
  }
} 