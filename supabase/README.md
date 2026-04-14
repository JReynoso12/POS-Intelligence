# Supabase migrations

## One-time setup (your machine)

1. Install dependencies from the **repo root** (`POS-Intelligence/`): `npm install`
2. Log in: `npx supabase login` (opens the browser)
3. Link this folder to your hosted project (get **Reference ID** under Project Settings → General):

   `npm run db:link`

   Use the database password you set when the project was created. This writes `.supabase/` under the repo root (gitignored).

4. Push migrations to the remote database:

   `npm run db:push`

You can run `npm run db:*` from any subfolder (for example `supabase/`) — scripts use `scripts/run-supabase.mjs` so the CLI always runs from the repo root. If you see **Cannot find project ref**, run `npm run db:link` first from a folder where `package.json` exists (repo root or a child).

## What runs automatically

- **GitHub Actions**: on push to `main` or `master`, when files under `supabase/migrations/` change, the workflow `.github/workflows/supabase-migrations.yml` runs `supabase link` + `supabase db push`. Configure secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`.

## Local database + seed

- `npm run db:start` — local Supabase (Docker required)
- `npm run db:reset` — applies migrations and `seed.sql`
- `npm run db:stop`

## Types for TypeScript

From repo root (after link): `npm run db:types` — writes `web/src/lib/database.types.ts` (ensure the `web` path exists).
