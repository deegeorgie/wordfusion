# V4 — Vercel deployment checklist

## 1. Database

V4 now targets PostgreSQL through Prisma. The old `db/custom.db` remains as a
local data source and backup; it is not the production database.

1. Create a managed PostgreSQL database.
2. Set `DATABASE_URL` in Vercel.
3. Deploy the Prisma schema:

```bash
npx prisma migrate deploy
```

4. To preserve the existing SQLite data, locally run:

```bash
python scripts/export-sqlite-to-postgres.py db/custom.db > v4-data.sql
```

Then apply `v4-data.sql` to the PostgreSQL database after the migration.

## 2. Environment variables

Configure these in Vercel Production (and Preview if desired):

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `CRON_SECRET`

Never copy the old development `NEXTAUTH_SECRET` into production.

## 3. Build

The production build is:

```bash
prisma generate && next build
```

The custom standalone copy step has been removed because Vercel handles the
Next.js deployment output.

## 4. Scheduled publication

`/api/puzzles/daily` is now read-only. Scheduled publishing is performed by:

```text
/api/cron/publish-puzzles
```

`vercel.json` invokes that endpoint every five minutes. The endpoint requires
`Authorization: Bearer <CRON_SECRET>`.

## 5. Authentication

Credentials authentication remains NextAuth JWT-based. The custom login route
no longer has a hard-coded fallback secret. `NEXTAUTH_SECRET` is mandatory.

## 6. AI generation

`/api/puzzles/generate` still uses `z-ai-web-dev-sdk`. Before enabling creator
AI generation in production, verify that the SDK is supported in the Vercel
runtime and that the provider credentials/configuration required by that SDK
are available in the Vercel environment.

## 7. Final smoke test

After deployment test:

- registration/login/logout
- admin and creator role restrictions
- daily puzzle loading
- puzzle check and hints
- progress/statistics/badges
- puzzle creation/editing
- scheduling and cron publication
- AI puzzle generation
- PDF export
- mobile layout
