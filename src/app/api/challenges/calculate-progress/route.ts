import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const { challenge_id, user_fid } = await request.json();
    
    if (!challenge_id) {
      return NextResponse.json({ error: 'challenge_id is required' }, { status: 400 });
    }

    console.log('🧮 [Progress] Calculating progress for challenge:', { challenge_id, user_fid });

    // Obtener información del challenge
    const challengeResult = await sql`
      SELECT 
        id, title, activity_type, objective_type, goal_amount, duration_days, start_date, badge_id
      FROM challenges 
      WHERE id = ${challenge_id}
    `;

    if (challengeResult.length === 0) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    const challenge = challengeResult[0];
    const startDate = new Date(challenge.start_date);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + challenge.duration_days - 1);

    console.log('📅 [Progress] Challenge period:', {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      activity_type: challenge.activity_type,
      objective_type: challenge.objective_type,
      goal_amount: challenge.goal_amount
    });

    // Si user_fid se proporciona, calcular solo para ese usuario
    // Si no, calcular para todos los participantes
    let participants;
    if (user_fid) {
      participants = await sql`
        SELECT user_fid, current_progress, has_completed
        FROM challenge_participants 
        WHERE challenge_id = ${challenge_id} AND user_fid = ${user_fid}
      `;
    } else {
      participants = await sql`
        SELECT user_fid, current_progress, has_completed
        FROM challenge_participants 
        WHERE challenge_id = ${challenge_id}
      `;
    }

    console.log('👥 [Progress] Processing participants:', participants.length);

    const results = [];

    for (const participant of participants) {
      const { user_fid: participantFid } = participant;
      
      try {
        // Obtener actividad diaria del usuario para este challenge
        const activityResult = await sql`
          SELECT date, steps, calories, sleep_hours
          FROM challenge_daily_activity
          WHERE challenge_id = ${challenge_id} 
            AND user_fid = ${participantFid}
            AND date >= ${startDate.toISOString().split('T')[0]}
            AND date <= ${endDate.toISOString().split('T')[0]}
          ORDER BY date
        `;

        let progress = 0;
        const activityField = getActivityField(challenge.activity_type);

        if (challenge.objective_type === 'total_amount') {
          // Sumar toda la actividad del período
          progress = activityResult.reduce((sum, day) => {
            return sum + (day[activityField] || 0);
          }, 0);
        } else if (challenge.objective_type === 'daily_goal') {
          // Contar días que cumplieron el objetivo diario
          progress = activityResult.filter(day => {
            return (day[activityField] || 0) >= challenge.goal_amount;
          }).length;
        }

        // Verificar si completó el challenge
        const isCompleted = progress >= challenge.goal_amount;
        const wasAlreadyCompleted = participant.has_completed;

        // Actualizar progreso en la base de datos
        await sql`
          UPDATE challenge_participants
          SET 
            current_progress = ${progress},
            has_completed = ${isCompleted},
            completed_at = ${isCompleted && !wasAlreadyCompleted ? 'CURRENT_TIMESTAMP' : 'completed_at'}
          WHERE challenge_id = ${challenge_id} AND user_fid = ${participantFid}
        `;

        // Si acaba de completar el challenge, otorgar badge
        if (isCompleted && !wasAlreadyCompleted && challenge.badge_id) {
          await awardBadge(participantFid, challenge.badge_id, challenge_id);
        }

        results.push({
          user_fid: participantFid,
          progress,
          goal_amount: challenge.goal_amount,
          is_completed: isCompleted,
          just_completed: isCompleted && !wasAlreadyCompleted,
          badge_awarded: isCompleted && !wasAlreadyCompleted && challenge.badge_id ? true : false
        });

        console.log(`✅ [Progress] User ${participantFid}: ${progress}/${challenge.goal_amount} (${isCompleted ? 'COMPLETED' : 'IN PROGRESS'})`);

      } catch (error) {
        console.error(`❌ [Progress] Error processing user ${participantFid}:`, error);
        results.push({
          user_fid: participantFid,
          error: 'Failed to calculate progress'
        });
      }
    }

    return NextResponse.json({
      success: true,
      challenge_id,
      challenge_title: challenge.title,
      results,
      summary: {
        total_participants: results.length,
        completed: results.filter(r => r.is_completed).length,
        just_completed: results.filter(r => r.just_completed).length,
        badges_awarded: results.filter(r => r.badge_awarded).length
      }
    });

  } catch (error) {
    console.error('❌ [Progress] Error calculating challenge progress:', error);
    return NextResponse.json(
      { error: 'Failed to calculate challenge progress' },
      { status: 500 }
    );
  }
}

// Función auxiliar para mapear tipo de actividad a campo de base de datos
function getActivityField(activityType: string): string {
  switch (activityType.toLowerCase()) {
    case 'steps':
      return 'steps';
    case 'calories':
      return 'calories';
    case 'sleep':
      return 'sleep_hours';
    default:
      return 'steps'; // default fallback
  }
}

// Función auxiliar para otorgar badge
async function awardBadge(userFid: number, badgeId: number, challengeId: number) {
  try {
    // Verificar si ya tiene el badge
    const existingBadge = await sql`
      SELECT id FROM user_badges 
      WHERE user_fid = ${userFid} AND badge_id = ${badgeId}
    `;

    if (existingBadge.length === 0) {
      await sql`
        INSERT INTO user_badges (user_fid, badge_id, earned_at)
        VALUES (${userFid}, ${badgeId}, CURRENT_TIMESTAMP)
      `;
      console.log(`🏆 [Badge] Awarded badge ${badgeId} to user ${userFid} for challenge ${challengeId}`);
    }
  } catch (error) {
    console.error(`❌ [Badge] Error awarding badge ${badgeId} to user ${userFid}:`, error);
  }
} 