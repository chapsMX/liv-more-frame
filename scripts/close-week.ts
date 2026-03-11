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
 */

import { neon } from '@neondatabase/serverless'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

// ─── Config ───────────────────────────────────────────────────────────────────

const DATABASE_URL   = process.env.DATABASE_URL!
const NFT_CONTRACT   = '0x73590BCC99a8E334454C08858da91d1e869558B9' as `0x${string}`
const BASE_RPC       = 'https://mainnet.base.org'

// Distribución de premios
const GENERAL_TOP_N          = 5
const GENERAL_POOL_PCT        = 0.60
const NFT_HOLDER_POOL_PCT     = 0.20
const OG_POOL_PCT             = 0.20
const GENERAL_EACH_PCT        = GENERAL_POOL_PCT / GENERAL_TOP_N  // 0.12

// ERC721 ABI mínimo para ownerOf
const ERC721_ABI = [
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '',        type: 'address'  }],
  },
] as const

// ─── Args ─────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const weekArg = args.includes('--week') ? Number(args[args.indexOf('--week') + 1]) : null
const yearArg = args.includes('--year') ? Number(args[args.indexOf('--year') + 1]) : null

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
    // La más reciente en estado 'active'
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

  console.log(`\n📅 Closing Week ${competition.week_number} · ${competition.year}`)
  console.log(`   ${competition.week_start} → ${competition.week_end}`)

  // 2. Calcular ganadores generales (top 5 pasos atestados)
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
      ds.date BETWEEN ${competition.week_start}::date AND ${competition.week_end}::date
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
      console.log(`   #${r.rank} ${r.username} — ${r.total_valid_steps.toLocaleString()} steps`)
    }
  }

  // 3. Calcular ganador NFT holder
  // Obtener todos los usuarios con eth_address y sus pasos atestados
  const allParticipants = await sql`
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
      ds.date BETWEEN ${competition.week_start}::date AND ${competition.week_end}::date
      AND ds.attestation_hash IS NOT NULL
      AND u.eth_address IS NOT NULL
    GROUP BY u.id, u.fid, u.username, u.og, u.eth_address
    ORDER BY total_valid_steps DESC
  `

  // Verificar on-chain quién tiene el NFT
  const viemClient = createPublicClient({
    chain:     base,
    transport: http(BASE_RPC),
  })

  let nftWinner: typeof allParticipants[0] | null = null
  console.log('\n🎭 Checking NFT holders on-chain...')

  for (const participant of allParticipants) {
    // El tokenId del NFT = fid del minter original
    // Verificamos si el participante actualmente posee su token o cualquier otro
    // que pertenezca a alguien con fid registrado
    try {
      // Buscar todos los fids registrados para verificar si este usuario tiene alguno
      const fidsRow = await sql`
        SELECT fid FROM "2026_users" WHERE eth_address IS NOT NULL
      `
      for (const fidRow of fidsRow) {
        const tokenId = BigInt(fidRow.fid)
        try {
          const owner = await viemClient.readContract({
            address:      NFT_CONTRACT,
            abi:          ERC721_ABI,
            functionName: 'ownerOf',
            args:         [tokenId],
          })
          if (owner.toLowerCase() === participant.eth_address.toLowerCase()) {
            nftWinner = participant
            console.log(`   ✅ NFT holder: ${participant.username} (tokenId ${tokenId})`)
            break
          }
        } catch {
          // Token no minteado o quemado, continuar
        }
      }
      if (nftWinner) break
    } catch {
      continue
    }
  }

  if (!nftWinner) {
    console.log('   ⚠️  No NFT holder found — prize accumulates')
  }

  // 4. Calcular ganador OG
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
      ds.date BETWEEN ${competition.week_start}::date AND ${competition.week_end}::date
      AND ds.attestation_hash IS NOT NULL
      AND u.og = true
    GROUP BY u.id, u.fid, u.username, u.og, u.eth_address
    ORDER BY total_valid_steps DESC
    LIMIT 1
  `
  const ogWinner = ogRows[0] ?? null

  console.log('\n⭐ OG Winner:')
  if (ogWinner) {
    console.log(`   ${ogWinner.username} — ${ogWinner.total_valid_steps.toLocaleString()} steps`)
  } else {
    console.log('   ⚠️  No OG found — prize accumulates')
  }

  // 5. Resumen de premios
  const pool = Number(competition.pool_amount ?? 0) + Number(competition.accumulated ?? 0)
  console.log(`\n💰 Pool: ${pool.toLocaleString()} $STEPS`)
  console.log(`   General (60%): ${(pool * GENERAL_POOL_PCT).toFixed(2)} ÷ ${GENERAL_TOP_N} = ${(pool * GENERAL_EACH_PCT).toFixed(2)} each`)
  console.log(`   NFT Holder (20%): ${(pool * NFT_HOLDER_POOL_PCT).toFixed(2)}`)
  console.log(`   OG (20%): ${(pool * OG_POOL_PCT).toFixed(2)}`)

  // 6. Calcular siguiente semana
  const currentEnd   = new Date(competition.week_end)
  const nextStart    = new Date(currentEnd)
  nextStart.setSeconds(nextStart.getSeconds() + 1)
  const nextEnd      = new Date(nextStart)
  nextEnd.setDate(nextEnd.getDate() + 6)
  nextEnd.setHours(17, 59, 59, 0)

  const nextWeekNum  = competition.week_number + 1
  const nextYear     = nextWeekNum > 52 ? competition.year + 1 : competition.year
  const nextWeekNorm = nextWeekNum > 52 ? 1 : nextWeekNum

  console.log(`\n📆 Next week: Week ${nextWeekNorm} · ${nextYear}`)
  console.log(`   ${nextStart.toISOString()} → ${nextEnd.toISOString()}`)

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

  // Insertar ganador NFT holder
  if (nftWinner) {
    await sql`
      INSERT INTO "2026_weekly_winners"
        (competition_id, user_id, category, rank, total_valid_steps, prize_percentage, prize_amount)
      VALUES (
        ${competition.id},
        ${nftWinner.user_id},
        'nft_holder',
        NULL,
        ${nftWinner.total_valid_steps},
        ${(NFT_HOLDER_POOL_PCT * 100).toFixed(2)},
        ${pool > 0 ? (pool * NFT_HOLDER_POOL_PCT).toFixed(8) : null}
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

  // Calcular acumulado para la siguiente semana
  const accumulatedNft = !nftWinner ? pool * NFT_HOLDER_POOL_PCT : 0
  const accumulatedOg  = !ogWinner  ? pool * OG_POOL_PCT         : 0
  const nextAccumulated = accumulatedNft + accumulatedOg

  // Insertar nueva semana
  await sql`
    INSERT INTO "2026_weekly_competitions"
      (week_number, year, week_start, week_end, status, accumulated)
    VALUES (
      ${nextWeekNorm},
      ${nextYear},
      ${nextStart.toISOString()},
      ${nextEnd.toISOString()},
      'active',
      ${nextAccumulated.toFixed(8)}
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