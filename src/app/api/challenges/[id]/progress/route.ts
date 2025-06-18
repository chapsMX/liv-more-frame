import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing challenge id' }, { status: 400 });
    }

    console.log('📊 [Progress Detail] Getting progress for challenge:', id);

    // Obtener información del challenge
    const challengeResult = await sql`
      SELECT 
        c.id, c.title, c.description, c.activity_type, c.objective_type, 
        c.goal_amount, c.duration_days, c.start_date, c.badge_id, c.is_official,
        b.name as badge_name, b.image_url as badge_image
      FROM challenges c
      LEFT JOIN badges b ON c.badge_id = b.id
      WHERE c.id = ${id}
    `;

    if (challengeResult.length === 0) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    const challenge = challengeResult[0];
    const startDate = new Date(challenge.start_date);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + challenge.duration_days - 1);
    const today = new Date().toISOString().split('T')[0];

    // Obtener participantes con su progreso
    const participantsResult = await sql`
      SELECT 
        cp.user_fid,
        cp.current_progress,
        cp.has_completed,
        cp.completed_at,
        cp.joined_at,
        wu.username,
        wu.display_name
      FROM challenge_participants cp
      LEFT JOIN whitelist_users wu ON cp.user_fid = wu.user_fid
      WHERE cp.challenge_id = ${id}
      ORDER BY cp.current_progress DESC, cp.joined_at ASC
    `;

    // Obtener actividad diaria agregada para el challenge
    const dailyActivityResult = await sql`
      SELECT 
        date,
        COUNT(*) as participants_count,
        AVG(CASE WHEN ${challenge.activity_type.toLowerCase()} = 'steps' THEN steps
                 WHEN ${challenge.activity_type.toLowerCase()} = 'calories' THEN calories  
                 WHEN ${challenge.activity_type.toLowerCase()} = 'sleep' THEN sleep_hours
                 ELSE steps END) as avg_activity,
        SUM(CASE WHEN ${challenge.activity_type.toLowerCase()} = 'steps' THEN steps
                 WHEN ${challenge.activity_type.toLowerCase()} = 'calories' THEN calories
                 WHEN ${challenge.activity_type.toLowerCase()} = 'sleep' THEN sleep_hours  
                 ELSE steps END) as total_activity
      FROM challenge_daily_activity
      WHERE challenge_id = ${id}
        AND date >= ${startDate.toISOString().split('T')[0]}
        AND date <= ${endDate.toISOString().split('T')[0]}
      GROUP BY date
      ORDER BY date
    `;

    // Calcular estadísticas
    const totalParticipants = participantsResult.length;
    const completedParticipants = participantsResult.filter(p => p.has_completed).length;
    const averageProgress = totalParticipants > 0 
      ? participantsResult.reduce((sum, p) => sum + (p.current_progress || 0), 0) / totalParticipants 
      : 0;

    // Determinar estado del challenge
    const challengeStarted = startDate <= new Date();
    const challengeEnded = endDate < new Date();
    let challengeStatus = 'upcoming';
    if (challengeStarted && !challengeEnded) {
      challengeStatus = 'active';
    } else if (challengeEnded) {
      challengeStatus = 'completed';
    }

    // Días restantes
    const daysRemaining = challengeEnded 
      ? 0 
      : Math.max(0, Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));

    // Top performers (top 10)
    const topPerformers = participantsResult
      .filter(p => p.current_progress > 0)
      .slice(0, 10)
      .map((p, index) => ({
        rank: index + 1,
        user_fid: p.user_fid,
        username: p.username || p.display_name || `User ${p.user_fid}`,
        progress: p.current_progress,
        percentage: Math.min(100, (p.current_progress / challenge.goal_amount) * 100),
        completed: p.has_completed,
        completed_at: p.completed_at
      }));

    return NextResponse.json({
      success: true,
      challenge: {
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        activity_type: challenge.activity_type,
        objective_type: challenge.objective_type,
        goal_amount: challenge.goal_amount,
        duration_days: challenge.duration_days,
        start_date: challenge.start_date,
        end_date: endDate.toISOString(),
        is_official: challenge.is_official,
        badge: challenge.badge_id ? {
          id: challenge.badge_id,
          name: challenge.badge_name,
          image_url: challenge.badge_image
        } : null,
        status: challengeStatus,
        days_remaining: daysRemaining
      },
      statistics: {
        total_participants: totalParticipants,
        completed_participants: completedParticipants,
        completion_rate: totalParticipants > 0 ? (completedParticipants / totalParticipants) * 100 : 0,
        average_progress: Math.round(averageProgress),
        average_progress_percentage: Math.min(100, (averageProgress / challenge.goal_amount) * 100)
      },
      participants: participantsResult.map(p => ({
        user_fid: p.user_fid,
        username: p.username || p.display_name || `User ${p.user_fid}`,
        progress: p.current_progress,
        percentage: Math.min(100, (p.current_progress / challenge.goal_amount) * 100),
        completed: p.has_completed,
        completed_at: p.completed_at,
        joined_at: p.joined_at
      })),
      top_performers: topPerformers,
      daily_activity: dailyActivityResult.map(day => ({
        date: day.date,
        participants_count: day.participants_count,
        avg_activity: Math.round(day.avg_activity || 0),
        total_activity: Math.round(day.total_activity || 0)
      }))
    });

  } catch (error) {
    console.error('❌ [Progress Detail] Error fetching challenge progress:', error);
    return NextResponse.json(
      { error: 'Error fetching challenge progress' },
      { status: 500 }
    );
  }
} 