import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const {
      user_fid,
      date,
      steps,
      calories,
      sleep_hours,
      steps_completed,
      calories_completed,
      sleep_completed,
      all_completed
    } = await request.json();

    // Validar datos requeridos
    if (!user_fid || !date) {
      return NextResponse.json(
        { error: 'user_fid and date are required' },
        { status: 400 }
      );
    }

    console.log('💾 [Daily Activity] Saving data for user:', {
      user_fid,
      date,
      steps,
      calories,
      sleep_hours
    });

    // Verificar si ya existe un registro para esa fecha
    const existingRecord = await sql`
      SELECT id FROM daily_activities
      WHERE user_fid = ${user_fid} AND date = ${date}
      LIMIT 1
    `;

    if (existingRecord.length > 0) {
      // Actualizar registro existente
      await sql`
        UPDATE daily_activities
        SET 
          steps = ${steps || 0},
          calories = ${calories || 0},
          sleep_hours = ${sleep_hours || 0},
          steps_completed = ${steps_completed || false},
          calories_completed = ${calories_completed || false},
          sleep_completed = ${sleep_completed || false},
          all_completed = ${all_completed || false},
          updated_at = CURRENT_TIMESTAMP
        WHERE user_fid = ${user_fid} AND date = ${date}
      `;
      
      console.log('✅ [Daily Activity] Record updated successfully');
    } else {
      // Crear nuevo registro
      await sql`
        INSERT INTO daily_activities (
          user_fid,
          date,
          steps,
          calories,
          sleep_hours,
          steps_completed,
          calories_completed,
          sleep_completed,
          all_completed,
          created_at,
          updated_at
        ) VALUES (
          ${user_fid},
          ${date},
          ${steps || 0},
          ${calories || 0},
          ${sleep_hours || 0},
          ${steps_completed || false},
          ${calories_completed || false},
          ${sleep_completed || false},
          ${all_completed || false},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `;
      
      console.log('✅ [Daily Activity] New record created successfully');
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Daily activity saved successfully' 
    });

  } catch (error) {
    console.error('❌ [Daily Activity] Error saving daily activity:', error);
    return NextResponse.json(
      { error: 'Failed to save daily activity' },
      { status: 500 }
    );
  }
} 