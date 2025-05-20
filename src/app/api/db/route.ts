import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    // Obtener todas las tablas
    const tables = await sql`
      SELECT 
        table_name,
        array_agg(
          json_build_object(
            'column_name', column_name,
            'data_type', data_type,
            'is_nullable', is_nullable,
            'column_default', column_default
          )
        ) as columns
      FROM information_schema.columns
      WHERE table_schema = 'public'
      GROUP BY table_name;
    `;

    // Obtener todas las relaciones (foreign keys)
    const foreignKeys = await sql`
      SELECT
        tc.table_name as table_name,
        kcu.column_name as column_name,
        ccu.table_name as foreign_table_name,
        ccu.column_name as foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY';
    `;

    // Obtener todos los índices
    const indices = await sql`
      SELECT
        tablename as table_name,
        indexname as index_name,
        indexdef as index_definition
      FROM pg_indexes
      WHERE schemaname = 'public';
    `;

    return NextResponse.json({
      tables,
      foreignKeys,
      indices
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Error obteniendo estructura de la base de datos:', error);
    return NextResponse.json({ 
      error: 'Error obteniendo estructura de la base de datos',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { 
      status: 500 
    });
  }
} 