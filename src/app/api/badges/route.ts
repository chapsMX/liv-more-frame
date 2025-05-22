import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { z } from 'zod';

// Configuración de la conexión a Neon
const sql = neon(process.env.DATABASE_URL!);

const ADMIN_FIDS = [20701, 348971, 1020677];

// Schema para validación de creación de badge
const createBadgeSchema = z.object({
  name: z.string().min(1),
  badge_type: z.string().min(1),
  total_supply: z.number().int().positive(),
  category: z.string().min(1),
  image_url: z.string().url(),
  description: z.string().min(1),
  metadata: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    badge_type: z.string().min(1),
    category: z.string().min(1),
    image: z.string().url()
  })
});

// GET /api/badges
export async function GET() {
  try {
    const result = await sql`
      SELECT 
        id,
        name,
        badge_type,
        total_supply,
        category,
        image_url,
        description,
        metadata,
        created_at
      FROM badges
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ badges: result }, { status: 200 });
  } catch (error) {
    console.error('Error fetching badges:', error);
    return NextResponse.json(
      { error: 'Error fetching badges' },
      { status: 500 }
    );
  }
}

// POST /api/badges
export async function POST(request: Request) {
  try {
    // Verificar si el usuario es admin
    const userFid = request.headers.get('x-user-fid');
    if (!userFid || !ADMIN_FIDS.includes(Number(userFid))) {
      return NextResponse.json(
        { error: 'Unauthorized: Only admins can create badges' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Validar el body con el schema
    const validatedData = createBadgeSchema.parse(body);

    // Insertar el badge en la base de datos
    const result = await sql`
      INSERT INTO badges (
        name,
        badge_type,
        total_supply,
        category,
        image_url,
        description,
        metadata
      ) VALUES (
        ${validatedData.name},
        ${validatedData.badge_type},
        ${validatedData.total_supply},
        ${validatedData.category},
        ${validatedData.image_url},
        ${validatedData.description},
        ${validatedData.metadata}
      )
      RETURNING *
    `;

    return NextResponse.json({ badge: result[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating badge:', error);
    return NextResponse.json(
      { error: 'Error creating badge' },
      { status: 500 }
    );
  }
} 