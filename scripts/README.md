# Migrations

Run the initial schema against your Neon database:

**Option A – Neon Dashboard**  
Open your Neon project → SQL Editor → paste and run `migrations/001_initial.sql`.

**Option B – psql**  
```bash
psql "$DATABASE_URL" -f migrations/001_initial.sql
```

Ensure `DATABASE_URL` is set in `.env` (or `.env.local`) for the app to connect.
