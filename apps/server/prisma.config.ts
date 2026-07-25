import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI configuration.
 *
 * Two problems this solves, both specific to running Prisma inside a workspace:
 *
 * 1. **`.env` location.** npm workspace scripts run with `apps/server` as the
 *    working directory, and the Prisma CLI only looks for `.env` next to the
 *    schema or in the cwd — never up at the repo root. So the root `.env` that
 *    the server itself reads was invisible to `prisma migrate`. Both locations
 *    are now loaded explicitly.
 *
 * 2. **`DIRECT_URL` being mandatory.** `schema.prisma` declares
 *    `directUrl = env("DIRECT_URL")`, which Prisma treats as required even
 *    though it only matters when `DATABASE_URL` points at a connection pooler.
 *    It now falls back to `DATABASE_URL`, so a plain Postgres URL is enough.
 *
 * This file also replaces the deprecated `package.json#prisma` block.
 */

const here = path.dirname(fileURLToPath(import.meta.url));

// dotenv does not overwrite already-set variables, so the first load wins:
// a real shell env beats apps/server/.env, which beats the repo root .env.
loadEnv({ path: path.join(here, '.env') });
loadEnv({ path: path.join(here, '..', '..', '.env') });

// Supabase gives you a pooled URL (port 6543) for the app and a direct one
// (5432) for migrations. With any ordinary Postgres they're the same thing.
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
