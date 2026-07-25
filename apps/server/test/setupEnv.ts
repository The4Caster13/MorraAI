/**
 * `config/env.ts` validates and freezes configuration at import time, so any
 * module that transitively imports it needs a valid environment before the
 * test file's own imports are evaluated. These values are inert placeholders —
 * nothing in the suite opens a socket to them.
 */
process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/parlons_test';
process.env.DIRECT_URL ??= 'postgresql://user:pass@localhost:5432/parlons_test';
process.env.SUPABASE_URL ??= 'https://test-project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
process.env.SUPABASE_AUDIO_BUCKET ??= 'session-audio';
process.env.EXAMINER_MODE ??= 'mock';
