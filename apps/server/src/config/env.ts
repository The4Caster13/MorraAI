import { z } from 'zod';
import { loadEnvFiles } from './loadEnvFiles.js';

// Must run before the schema below is parsed.
loadEnvFiles();

/**
 * Treats an unfilled value as absent.
 *
 * `.env.example` ships templates like `https://<project-ref>.supabase.co`. A
 * half-filled template is not a configuration error worth refusing to boot
 * over — it means "I haven't set this up yet", which for optional services is
 * a perfectly reasonable state to run in.
 */
export function blankIfUnfilled(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  if (trimmed.includes('<') || trimmed.includes('>')) return undefined;
  return trimmed;
}

const optionalFilled = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(blankIfUnfilled, schema.optional());

/**
 * Rejects a connection string that still contains an unreplaced `<placeholder>`.
 *
 * Without this the value reaches the database and comes back as
 * `FATAL: tenant/user postgres.<ref> not found` — an authentication error that
 * reads like a credentials problem rather than an unedited template.
 */
// Supabase writes its password placeholder as [YOUR-PASSWORD]; other providers
// use <angle brackets>. Bracketed IPv6 hosts (`[::1]`, `[fe80::1]`) contain
// digits and colons, so requiring letters, hyphens and underscores only keeps
// them out of this check.
const PLACEHOLDER = /<[^>]*>|\[[A-Za-z][A-Za-z_-]*\]/;

const connectionString = (name: string) =>
  z
    .string()
    .min(1)
    .refine((v) => !PLACEHOLDER.test(v), {
      message: `${name} still contains a placeholder such as <ref> or [YOUR-PASSWORD]. Replace it with the real value — on Supabase, copy the string from Connect → Session pooler, then substitute your database password.`,
    });

const envSchema = z.object({
  DATABASE_URL: connectionString('DATABASE_URL'),
  DIRECT_URL: connectionString('DIRECT_URL').optional(),
  // Optional: absent entirely in local-Postgres dev, where audio is written to
  // disk instead. See storageMode() below.
  SUPABASE_URL: optionalFilled(z.string().url()),
  SUPABASE_SERVICE_ROLE_KEY: optionalFilled(z.string().min(1)),
  SUPABASE_AUDIO_BUCKET: z.string().default('session-audio'),
  STORAGE_MODE: z.enum(['local', 'supabase']).optional(),
  // Only read when storageMode() resolves to 'local'.
  LOCAL_AUDIO_DIR: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  // Verified against this project's key by `npm run check:gemini`:
  // gemini-3.1-flash-live-preview returned 145KB of audio at 689ms to first
  // byte, while gemini-2.5-flash-native-audio-preview-09-2025 does not appear
  // in Google's model list at all. Fallback if this is retired:
  // gemini-2.5-flash-native-audio-preview-12-2025.
  GEMINI_LIVE_MODEL: z.string().default('gemini-3.1-flash-live-preview'),
  // 2.5-era models (including the "-latest" alias, which still resolves to
  // 2.5-flash) are sunset for this project's API key — confirmed directly
  // against the account, not merely undocumented. Use the newest generally
  // available flash model instead.
  GEMINI_SCORING_MODEL: z.string().default('gemini-3.5-flash'),
  // Prebuilt Live voice. Some Live models transcribe their own speech but
  // synthesise no audio until a voice is named.
  GEMINI_VOICE: z.string().default('Kore'),
  EXAMINER_MODE: z.enum(['mock', 'gemini']).optional(),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Origin allowed to call the API in development, where Vite serves the SPA
  // on a different port. Unused in production (single-origin deployment).
  DEV_WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (result.success) return result.data;

  // A Zod stack trace buries the one line that matters.
  const lines = result.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`);
  console.error(`\nConfiguration problem in .env:\n${lines.join('\n')}\n`);
  process.exit(1);
}

export const env: Env = parseEnv();

export function examinerMode(e: Env = env): 'mock' | 'gemini' {
  if (e.EXAMINER_MODE) return e.EXAMINER_MODE;
  return e.GEMINI_API_KEY ? 'gemini' : 'mock';
}

export function storageMode(e: Env = env): 'local' | 'supabase' {
  if (e.STORAGE_MODE) return e.STORAGE_MODE;
  return e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'local';
}
