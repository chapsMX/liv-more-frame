# LivMore

MiniApp para Farcaster, la app morada.
Turn healthy habits into rewards.

**LivMore** is a [Farcaster Mini App](https://miniapps.farcaster.xyz/) built with **Next.js 15** (App Router) and **React 19**. Users connect a wearable (**Garmin**, **Polar**, or **Oura**), sync daily steps into **PostgreSQL (Neon)**, **attest** days on-chain with **Ethereum Attestation Service (EAS)** on Base, and compete on **weekly** and **monthly** leaderboards tied to the **$STEPS** ecosystem.

---

## Highlights

- **Miniapp SDK** — Identity and wallet via `@farcaster/miniapp-sdk` (no legacy Frames-only client in the main shell).
- **Wearables** — OAuth / webhooks per provider; steps stored per user per calendar day in `2026_daily_steps`.
- **Attestations** — Delegated EAS flow: server signs typed data; user submits attestation and pays gas; UID persisted on the step row.
- **Leaderboards** — Monthly (attested steps), all-time records (`2026_records`), chronological **Feed**, and weekly competition APIs.
- **Google Fit** — **Removed** from the app (OAuth and Fitness API routes deleted). Users who still have `provider = 'google'` in the database keep **full app access**; steps are **not** synced from Google (table shows only data already in the DB). New connections are Garmin, Polar, or Oura only.

---

## Architecture (overview)

1. **Client** — `LivMore.tsx` (loaded with `dynamic(..., { ssr: false })` from `app.tsx`). Tabs: Home, Leaderboard, weekly $STEPS (Steps), OG; links to control panel and optional standalone leaderboard page.
2. **HTTP** — The miniapp calls `fetch('/api/...')` into Next.js Route Handlers under `src/app/api/**/route.ts`.
3. **Data** — `@neondatabase/serverless` runs SQL against **Neon** (PostgreSQL). Table names may be quoted (e.g. `"2026_users"`).

- **Entry:** `src/app/page.tsx` → `src/app/app.tsx` → `src/components/LivMore.tsx`.
- **Layout:** `src/app/layout.tsx` — global styles, font variable, Vercel Analytics.
- **Share / OG images:** Dynamic routes under `src/app/share/**` and `src/app/api/img-*` (where present) for casts and frames metadata.

---

## Repository layout (main areas)

| Path | Role |
|------|------|
| `src/app/` | App Router: pages, metadata, API routes |
| `src/components/` | UI: `LivMore`, `Leaderboard`, `Steps`, `ConnectDevice`, `ControlPanel`, etc. |
| `src/lib/` | DB client, retries, OAuth helpers, EAS/OG utilities |
| `src/types/` | Shared TS types (e.g. `AppUser`) |
| `scripts/` | Operational scripts (records, week close, webhook registration) |
| `scripts/migrations/` | SQL migrations (run manually against `DATABASE_URL`) |

---

## API surface (summary)

All handlers live under `src/app/api/`. Common patterns: JSON in/out, server-only secrets, `fid` or session-derived identity where applicable.

| Area | Examples |
|------|----------|
| **User** | `GET/POST/PATCH /api/user` — ensure user, read/update `provider`, OG flag |
| **Attest** | `POST /api/attest/sign`, `POST /api/attest/confirm` |
| **Leaderboard** | `/api/leaderboard/monthly`, `months`, `alltime`, `feed`, `weekly`, `weekly/history` |
| **Social** | `/api/neynar` — profile lookups |
| **Auth / devices** | Garmin (`/api/auth/garmin-v1/...`), Polar, Oura connect + callbacks |
| **Webhooks** | Garmin, Polar, Oura — ingest activity and upsert `2026_daily_steps` |
| **Whitelist** | `/api/whitelist/*` — if enabled for your deployment |

> **Note:** If the client calls an endpoint (e.g. steps range), ensure the corresponding `route.ts` exists in your branch; add or restore routes as needed.

---

## Database (conceptual)

- **`2026_users`** — Farcaster `fid`, username, `provider` (`garmin` \| `polar` \| `oura` \| legacy `google` \| `null`), `og`, optional provider tokens (server-side).
- **`2026_daily_steps`** — `user_id`, `date`, `steps`, `attestation_hash` (EAS UID when attested).
- **Weekly competition** — competitions + winners tables (used by Steps tab and `close-week` script).
- **`2026_records`** — Cached all-time daily / weekly / monthly step records (attested-only); populated by `update-records`.
- **Provider-specific** — e.g. Polar / Oura / Garmin connection tables as created by migrations.

Apply SQL in `scripts/migrations/` with `psql` (or your SQL client); **never** commit real `DATABASE_URL` or credentials.

---

## Operational scripts

| Script | Purpose |
|--------|---------|
| `npm run update-records` | Recompute all-time records into `2026_records` (attested days only). |
| `npx tsx scripts/close-week.ts` | Close prior week, write winners, advance competition (see file header for flags). |
| `npx tsx scripts/register-polar-webhook.ts` | One-time Polar webhook registration per environment. |
| `npm run register-oura-webhook` | Oura webhook subscriptions (see script for env vars). |

---

## Environment variables

Create **`.env.local`** (gitignored). Document only **names** and purpose here; **never** paste real keys into the repo.

**Required / common:**

- `DATABASE_URL` — Neon connection string  
- `NEXT_PUBLIC_URL` — Public app URL (e.g. production domain)  
- `NEYNAR_API_KEY` — Server-side Neynar API  

**Wearables (per integration):**

- Garmin: client id/secret, redirect URIs for OAuth 1.0a flow  
- Polar: client id/secret, `POLAR_WEBHOOK_SECRET`, redirect URI  
- Oura: client id/secret, `OURA_VERIFICATION_TOKEN`, redirect URI, webhook IDs if used  

**Attestations / chain:**

- EAS schema / contract settings as used by `attest/sign` and the client  
- Attester / signer private key **server-only** (never `NEXT_PUBLIC_*`)  

**Optional:**

- Vercel Analytics, Edge Config, etc., if configured  

**Removed:** Google OAuth / Fitness env vars — remove from hosting dashboards if still listed.

---

## Local development

```bash
npm install
# Copy and fill .env.local with your own values (do not commit)
npm run dev
```

```bash
npm run build
npm start
```

---

## Product and links

- **Website:** [livmore.life](https://livmore.life/)  
- **BUIDL WEEK by Base** — LivMore won the “Build a Farcaster Mini App” track: [announcement](https://x.com/buildonbase/status/1897391136270106928)  
- **Just Frame It** — [frame-it.builders.garden](https://frame-it.builders.garden/)  
- **Devfolio:** [liv-more on Devfolio](https://devfolio.co/projects/liv-more-015f)  

Upstream inspiration: Frames / Mini Apps ecosystem (e.g. [frames-v2-demo](https://github.com/farcasterxyz/frames-v2-demo)).

---

## Security and privacy

Treat all API keys and database URLs as **confidential**. Rotate any credential that has appeared in a commit, ticket, or screenshot.
