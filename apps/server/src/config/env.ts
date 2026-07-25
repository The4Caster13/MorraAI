import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_AUDIO_BUCKET: z.string().default('session-audio'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_LIVE_MODEL: z.string().default('gemini-2.5-flash-native-audio-preview-09-2025'),
  GEMINI_SCORING_MODEL: z.string().default('gemini-2.5-flash'),
  EXAMINER_MODE: z.enum(['mock', 'gemini']).optional(),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Origin allowed to call the API in development, where Vite serves the SPA
  // on a different port. Unused in production (single-origin deployment).
  DEV_WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);

export function examinerMode(e: Env = env): 'mock' | 'gemini' {
  if (e.EXAMINER_MODE) return e.EXAMINER_MODE;
  return e.GEMINI_API_KEY ? 'gemini' : 'mock';
}
