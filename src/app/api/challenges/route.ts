import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);
/* const ADMIN_FIDS = [20701, 348971, 1020677]; */

// Tipos de objetivos predefinidos
const OBJECTIVE_TYPES = [
  {
    id: 'max_value',
    name: 'Maximum Value',
    /* description: 'El participante que alcance el mayor valor gana' */
  },
  {
    id: 'daily_minimum',
    name: 'Daily Minimum',
    /* description: 'Los participantes deben alcanzar un mínimo diario para completar el reto' */
  },
  {
    id: 'total_goal',
    name: 'Total Goal',
    /* description: 'Los participantes deben alcanzar una meta total en el período del reto' */
  }
];

export async function GET() {
  try {
    // Obtener tipos de actividad
    const activityTypes = await sql`
      SELECT id, name, description 
      FROM activity_types 
      WHERE is_active = true
    `;

    // Obtener retos visibles, ordenados por fecha de inicio descendente
    const challenges = await sql`
      SELECT id, title, description, activity_type, objective_type, goal_amount, duration_days, start_date, image_url, is_official, points_value, badge_id, entry_cost
      FROM challenges
      WHERE visible = true
      ORDER BY start_date DESC
    `;

    return NextResponse.json({
      activity_types: activityTypes,
      objective_types: OBJECTIVE_TYPES,
      challenges: challenges
    });
  } catch (error) {
    console.error('Error fetching challenge types:', error);
    return NextResponse.json(
      { error: 'Error fetching challenge types' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const {
      user_fid,
      title,
      description,
      activity_type_id,
      objective_type,
      goal_amount,
      duration_days,
      start_date,
      image_url,
      is_official,
      points_value,
      badge_id,
      entry_cost
    } = await request.json();

    // Validar campos requeridos
    if (!user_fid || !title || !description || !activity_type_id || !objective_type || 
        !goal_amount || !duration_days || !start_date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validar que el usuario existe y tiene permisos
    const userResult = await sql`
      SELECT can_create 
      FROM whitelist_users 
      WHERE user_fid = ${user_fid}
    `;

    if (userResult.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Validar que el usuario puede crear retos
    if (!userResult[0].can_create) {
      return NextResponse.json(
        { error: 'User not authorized to create challenges' },
        { status: 403 }
      );
    }

    // Validar que el tipo de actividad existe por id
    const activityTypeResult = await sql`
      SELECT id, name 
      FROM activity_types 
      WHERE id = ${activity_type_id} AND is_active = true
    `;

    if (activityTypeResult.length === 0) {
      return NextResponse.json(
        { error: 'Invalid activity type' },
        { status: 400 }
      );
    }

    // Validar que el tipo de objetivo es válido
    const validObjectiveTypes = OBJECTIVE_TYPES.map(t => t.id);
    if (!validObjectiveTypes.includes(objective_type)) {
      return NextResponse.json(
        { error: 'Invalid objective type' },
        { status: 400 }
      );
    }

    // Insertar el reto
    const result = await sql`
      INSERT INTO challenges (
        creator_fid,
        title,
        description,
        activity_type_id,
        activity_type,
        objective_type,
        goal_amount,
        duration_days,
        start_date,
        image_url,
        is_official,
        points_value,
        badge_id,
        entry_cost,
        visible,
        challenge_status
      ) VALUES (
        ${user_fid},
        ${title},
        ${description},
        ${activity_type_id},
        ${activityTypeResult[0].name},
        ${objective_type},
        ${goal_amount},
        ${duration_days},
        ${start_date},
        ${image_url},
        ${is_official},
        ${points_value},
        ${badge_id},
        ${entry_cost},
        true,
        'registration'
      )
      RETURNING id
    `;

    return NextResponse.json({ 
      success: true, 
      challenge_id: result[0].id 
    });

  } catch (error) {
    console.error('Error creating challenge:', error);
    return NextResponse.json(
      { error: 'Error creating challenge' },
      { status: 500 }
    );
  }
} 