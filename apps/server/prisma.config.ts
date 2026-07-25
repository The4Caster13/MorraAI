import path from 'node:path';
import { defineConfig } from 'prisma/config';
import { loadEnvFiles } from './src/config/loadEnvFiles.js';

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
 * Both are handled by `loadEnvFiles`, which the server and the seed script also
 * use — they hit the same problem and must resolve config identically.
 *
 * This file also replaces the deprecated `package.json#prisma` block.
 */

loadEnvFiles();

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
