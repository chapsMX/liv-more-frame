import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

/** Tablas de la nueva versión (reconstrucción 2026). El resto de tablas en la BD son legado. */
const PREFIX_2026 = "2026_";

export async function GET() {
  try {
    // Solo tablas con prefijo 2026_ (nueva versión)
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
        ) AS columns
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name LIKE ${PREFIX_2026 + "%"}
      GROUP BY table_name
      ORDER BY table_name
    `;

    // Relaciones (solo FKs que involucran tablas 2026_)
    const foreignKeys = await sql`
      SELECT
        tc.table_name AS table_name,
        kcu.column_name AS column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name LIKE ${PREFIX_2026 + "%"}
      ORDER BY tc.table_name, kcu.column_name
    `;

    // Índices (solo de tablas 2026_)
    const indices = await sql`
      SELECT
        tablename AS table_name,
        indexname AS index_name,
        indexdef AS index_definition
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename LIKE ${PREFIX_2026 + "%"}
      ORDER BY tablename, indexname
    `;

    return NextResponse.json(
      {
        note: "Solo tablas con prefijo 2026_ (nueva versión). El resto de la BD es legado.",
        tables,
        foreignKeys,
        indices,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error obteniendo estructura de la base de datos:", error);
    return NextResponse.json(
      {
        error: "Error obteniendo estructura de la base de datos",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
