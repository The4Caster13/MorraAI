import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

/**
 * Loads `.env` for anything that runs inside `apps/server`.
 *
 * `import 'dotenv/config'` reads `.env` from the *current working directory*
 * only. npm workspace scripts run with `apps/server` as the cwd, so the repo
 * root `.env` — the documented location — is never seen. Every entry point
 * under `apps/server` (the server, the seed script, the Prisma CLI config)
 * therefore has to load it explicitly, and by absolute path rather than
 * relative to wherever the process happened to start.
 *
 * dotenv does not overwrite variables that are already set, so precedence is:
 * real shell environment > apps/server/.env > repo root .env.
 */

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoRoot = path.resolve(serverRoot, '..', '..');

let loaded = false;

export function loadEnvFiles(): void {
  if (loaded) return;
  loaded = true;

  loadEnv({ path: path.join(serverRoot, '.env') });
  loadEnv({ path: path.join(repoRoot, '.env') });

  // `schema.prisma` declares `directUrl = env("DIRECT_URL")`, which Prisma
  // treats as mandatory. It only differs from DATABASE_URL when that points at
  // a connection pooler (Supabase: 6543 pooled, 5432 direct), because
  // migrations can't run through one. For any ordinary Postgres they're equal.
  if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
}
