/**
 * scripts/close-week.ts
 *
 * Corre cada martes para:
 * 1. Calcular ganadores de la semana anterior
 * 2. Guardar ganadores en 2026_weekly_winners
 * 3. Marcar la semana como 'completed'
 * 4. Insertar la nueva semana activa
 *
 * Uso:
 *   npx tsx scripts/close-week.ts
 *
 * Flags opcionales:
 *   --dry-run   Solo muestra los ganadores sin escribir en la DB
 *   --week 10   Cierra una semana específica por número
 *   --year 2026
 *   --pool 1000 Define el pool de la siguiente semana
 */

import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

// ─── Config ───────────────────────────────────────────────────────────────────

const DATABASE_URL     = process.env.DATABASE_URL!

const GENERAL_TOP_N    = 5
const GENERAL_POOL_PCT = 0.60
const OG_POOL_PCT      = 0.20
const GENERAL_EACH_PCT = GENERAL_POOL_PCT / GENERAL_TOP_N  // 0.12

// ─── Args ─────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const weekArg = args.includes('--week') ? Number(args[args.indexOf('--week') + 1]) : null
const yearArg = args.includes('--year') ? Number(args[args.indexOf('--year') + 1]) : null
const poolArg = args.includes('--pool') ? Number(args[args.indexOf('--pool') + 1]) : null

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const sql = neon(DATABASE_URL)

  console.log('━'.repeat(50))
  console.log(DRY_RUN ? '🔍 DRY RUN — no DB writes' : '🚀 Running weekly close')
  console.log('━'.repeat(50))

  // 1. Obtener la semana a cerrar
  let competition: any

  if (weekArg && yearArg) {
    const rows = await sql`
      SELECT * FROM "2026_weekly_competitions"
      WHERE week_number = ${weekArg} AND year = ${yearArg}
      LIMIT 1
    `
    competition = rows[0]
  } else {
    const rows = await sql`
      SELECT * FROM "2026_weekly_competitions"
      WHERE status = 'active'
      ORDER BY year DESC, week_number DESC
      LIMIT 1
    `
    competition = rows[0]
  }

  if (!competition) {
    console.error('❌ No active competition found.')
    process.exit(1)
  }

  // Extraer fechas calendario limpias (sin timezone)
  const weekStart = new Date(competition.week_start).toISOString().split('T')[0] // "2026-03-16"
  const weekEnd   = new Date(competition.week_end).toISOString().split('T')[0]   // "2026-03-22"

  console.log(`\n📅 Closing Week ${competition.week_number} · ${competition.year}`)
  console.log(`   ${weekStart} → ${weekEnd}`)

  // 2. Calcular top 5 general
  const generalRows = await sql`
    SELECT
      u.id        AS user_id,
      u.fid,
      u.username,
      u.og,
      u.eth_address,
      SUM(ds.steps)::int AS total_valid_steps,
      ROW_NUMBER() OVER (ORDER BY SUM(ds.steps) DESC)::int AS rank
    FROM "2026_daily_steps" ds
    JOIN "2026_users" u ON u.id = ds.user_id
    WHERE
      ds.date BETWEEN ${weekStart}::date AND ${weekEnd}::date
      AND ds.attestation_hash IS NOT NULL
    GROUP BY u.id, u.fid, u.username, u.og, u.eth_address
    ORDER BY total_valid_steps DESC
    LIMIT ${GENERAL_TOP_N}
  `

  console.log(`\n🏆 General Top ${GENERAL_TOP_N}:`)
  if (generalRows.length === 0) {
    console.log('   (none)')
  } else {
    for (const r of generalRows) {
      const ogBadge = r.og ? ' 💎 OG' : ''
      console.log(`   #${r.rank} ${r.username}${ogBadge} — ${r.total_valid_steps.toLocaleString()} steps`)
    }
  }

  // 3. Verificar si hay OG entre los ganadores del top 5
  const ogWinnersInTop5 = generalRows.filter(r => r.og)
  console.log('\n⭐ OG in Top 5:')
  if (ogWinnersInTop5.length > 0) {
    for (const w of ogWinnersInTop5) {
      console.log(`   💎 ${w.username} — #${w.rank} with ${w.total_valid_steps.toLocaleString()} steps`)
    }
  } else {
    console.log('   ⚠️  No OG in top 5 this week')
  }

  // 4. Calcular ganador OG (el de más pasos con og=true)
  const ogRows = await sql`
    SELECT
      u.id        AS user_id,
      u.fid,
      u.username,
      u.og,
      u.eth_address,
      SUM(ds.steps)::int AS total_valid_steps
    FROM "2026_daily_steps" ds
    JOIN "2026_users" u ON u.id = ds.user_id
    WHERE
      ds.date BETWEEN ${weekStart}::date AND ${weekEnd}::date
      AND ds.attestation_hash IS NOT NULL
      AND u.og = true
    GROUP BY u.id, u.fid, u.username, u.og, u.eth_address
    ORDER BY total_valid_steps DESC
    LIMIT 1
  `
  const ogWinner = ogRows[0] ?? null

  if (ogWinner && !ogWinnersInTop5.find(w => w.user_id === ogWinner.user_id)) {
    console.log(`\n   ℹ️  OG category winner (outside top 5): ${ogWinner.username} — ${ogWinner.total_valid_steps.toLocaleString()} steps`)
  }

  // 5. Resumen de premios
  const pool = Number(competition.pool_amount ?? 0) + Number(competition.accumulated ?? 0)
  console.log(`\n💰 Pool: ${pool.toLocaleString()} $STEPS`)
  console.log(`   General (60%): ${(pool * GENERAL_POOL_PCT).toFixed(2)} ÷ ${GENERAL_TOP_N} = ${(pool * GENERAL_EACH_PCT).toFixed(2)} each`)
  console.log(`   OG (20%): ${ogWinner ? `${(pool * OG_POOL_PCT).toFixed(2)} → ${ogWinner.username}` : '⚠️  accumulates'}`)
  console.log(`   NFT Holder (20%): pending manual check`)

  // 6. Calcular siguiente semana
  const currentEnd  = new Date(competition.week_end)
  const nextStart   = new Date(currentEnd)
  nextStart.setSeconds(nextStart.getSeconds() + 1)
  const nextEnd     = new Date(nextStart)
  nextEnd.setDate(nextEnd.getDate() + 6)
  nextEnd.setHours(23, 59, 59, 0)

  const nextWeekNum  = competition.week_number + 1
  const nextYear     = nextWeekNum > 52 ? competition.year + 1 : competition.year
  const nextWeekNorm = nextWeekNum > 52 ? 1 : nextWeekNum

  console.log(`\n📆 Next week: Week ${nextWeekNorm} · ${nextYear}`)
  console.log(`   ${nextStart.toISOString().split('T')[0]} → ${nextEnd.toISOString().split('T')[0]}`)

  // ── DRY RUN: salir aquí ───────────────────────────────────────────────────
  if (DRY_RUN) {
    console.log('\n✅ Dry run complete — no changes made.')
    return
  }

  // 7. Escribir en DB
  console.log('\n💾 Writing to DB...')

  // Insertar ganadores generales
  for (const w of generalRows) {
    await sql`
      INSERT INTO "2026_weekly_winners"
        (competition_id, user_id, category, rank, total_valid_steps, prize_percentage, prize_amount)
      VALUES (
        ${competition.id},
        ${w.user_id},
        'general',
        ${w.rank},
        ${w.total_valid_steps},
        ${(GENERAL_EACH_PCT * 100).toFixed(2)},
        ${pool > 0 ? (pool * GENERAL_EACH_PCT).toFixed(8) : null}
      )
      ON CONFLICT (competition_id, category, user_id) DO NOTHING
    `
  }

  // Insertar ganador OG
  if (ogWinner) {
    await sql`
      INSERT INTO "2026_weekly_winners"
        (competition_id, user_id, category, rank, total_valid_steps, prize_percentage, prize_amount)
      VALUES (
        ${competition.id},
        ${ogWinner.user_id},
        'og',
        NULL,
        ${ogWinner.total_valid_steps},
        ${(OG_POOL_PCT * 100).toFixed(2)},
        ${pool > 0 ? (pool * OG_POOL_PCT).toFixed(8) : null}
      )
      ON CONFLICT (competition_id, category, user_id) DO NOTHING
    `
  }

  // Marcar semana actual como completada
  await sql`
    UPDATE "2026_weekly_competitions"
    SET status = 'completed'
    WHERE id = ${competition.id}
  `

  // Acumulado para siguiente semana (solo OG si no hay ganador)
  const nextAccumulated = !ogWinner ? pool * OG_POOL_PCT : 0

  // Insertar nueva semana
  await sql`
    INSERT INTO "2026_weekly_competitions"
      (week_number, year, week_start, week_end, status, accumulated, pool_amount)
    VALUES (
      ${nextWeekNorm},
      ${nextYear},
      ${nextStart.toISOString()},
      ${nextEnd.toISOString()},
      'active',
      ${nextAccumulated.toFixed(8)},
      ${poolArg ?? null}
    )
    ON CONFLICT (week_number, year) DO NOTHING
  `

  console.log('   ✅ Winners saved')
  console.log('   ✅ Week marked as completed')
  console.log(`   ✅ Week ${nextWeekNorm} created${nextAccumulated > 0 ? ` (accumulated: ${nextAccumulated.toFixed(2)})` : ''}`)
  console.log('\n🏁 Done.')
}

main().catch(err => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})