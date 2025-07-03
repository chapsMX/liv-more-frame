import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const { user_fid, challenge_id, start_date, end_date } = await request.json();
    if (!user_fid || !challenge_id || !start_date || !end_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Obtener rook_user_id
    const rookRes = await sql`SELECT rook_user_id FROM rook_connection WHERE user_fid = ${user_fid}`;
    if (!rookRes[0] || !rookRes[0].rook_user_id) {
      return NextResponse.json({ error: 'No rook_user_id found' }, { status: 404 });
    }
    const rook_user_id = rookRes[0].rook_user_id;

    // Fechas a sincronizar
    const start = new Date(start_date);
    const end = new Date(end_date);
    // ✅ SAFETY: Prevenir sincronización de fechas futuras
    const today = new Date();
    const maxSyncDate = end > today ? today : end;
    
    console.log('🔄 [Sync History] Syncing from', start_date, 'to', maxSyncDate.toISOString().split('T')[0]);
    
    let synced = 0;
    for (let d = new Date(start); d <= maxSyncDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      
      // ✅ EXTRA SAFETY: Skip future dates
      if (new Date(dateStr) > today) {
        console.log('⚠️ [Sync History] Skipping future date:', dateStr);
        break;
      }
      
      // ¿Ya existe registro?
      const exists = await sql`
        SELECT id FROM challenge_daily_activity WHERE challenge_id = ${challenge_id} AND user_fid = ${user_fid} AND date = ${dateStr}
      `;
      if (exists.length > 0) continue;
      
      console.log('📅 [Sync History] Processing date:', dateStr);
      
      // Obtener datos de Rook
      const physicalRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/users/physical-summary?user_id=${rook_user_id}&date=${dateStr}`);
      const physical = await physicalRes.json();
      const sleepRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/users/sleep-summary?user_id=${rook_user_id}&date=${dateStr}`);
      const sleep = await sleepRes.json();
      // Insertar
      await sql`
        INSERT INTO challenge_daily_activity (challenge_id, user_fid, date, steps, calories, sleep_hours)
        VALUES (${challenge_id}, ${user_fid}, ${dateStr}, ${physical.steps || 0}, ${physical.calories || 0}, ${sleep.sleep_duration_hours || 0})
      `;
      synced++;
    }
    
    console.log('✅ [Sync History] Completed. Records synced:', synced);
    return NextResponse.json({ success: true, synced });
  } catch (error) {
    console.error('Error syncing challenge history:', error);
    return NextResponse.json({ error: 'Error syncing challenge history' }, { status: 500 });
  }
} 