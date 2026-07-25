import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, storageMode } from '../config/env.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/**
 * Session audio storage.
 *
 * Audio is student voice data — often from minors — so it is never exposed
 * directly. With Supabase it lives in a *private* bucket reached only with the
 * service-role key; on local disk it sits outside the served directories. In
 * both cases the browser fetches audio through
 * `GET /api/sessions/:id/audio/...`, which applies ownership checks first.
 *
 * Supabase is used when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set;
 * otherwise audio is written to `storage/` at the repo root, so the app runs
 * with nothing configured beyond a database.
 */
export interface StorageService {
  uploadAudio(path: string, wav: Buffer): Promise<void>;
  downloadAudio(path: string): Promise<Buffer>;
  deleteSessionAudio(sessionId: string): Promise<void>;
}

/** Deterministic object key for one phase/speaker leg of a session. */
export function audioPath(sessionId: string, phase: string, speaker: string): string {
  return `sessions/${sessionId}/${phase}-${speaker}.wav`.toLowerCase();
}

class SupabaseStorageService implements StorageService {
  private client: SupabaseClient;

  constructor(
    private bucket: string,
    supabaseUrl: string,
    supabaseServiceRoleKey: string,
  ) {
    this.client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async uploadAudio(path: string, wav: Buffer): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).upload(path, wav, {
      contentType: 'audio/wav',
      upsert: true,
    });
    if (error) throw new Error(`Audio upload failed for ${path}: ${error.message}`);
  }

  async downloadAudio(path: string): Promise<Buffer> {
    const { data, error } = await this.client.storage.from(this.bucket).download(path);
    if (error) throw new Error(`Audio download failed for ${path}: ${error.message}`);
    return Buffer.from(await data.arrayBuffer());
  }

  async deleteSessionAudio(sessionId: string): Promise<void> {
    const prefix = `sessions/${sessionId}`.toLowerCase();
    const { data, error } = await this.client.storage.from(this.bucket).list(prefix);
    if (error) throw new Error(`Audio listing failed for ${prefix}: ${error.message}`);
    if (!data || data.length === 0) return;
    const paths = data.map((f) => `${prefix}/${f.name}`);
    const { error: removeError } = await this.client.storage.from(this.bucket).remove(paths);
    if (removeError) {
      throw new Error(`Audio deletion failed for ${prefix}: ${removeError.message}`);
    }
  }
}

/**
 * Local-disk backend for development against a local Postgres, where there's
 * no Supabase project to hold audio either. Writes under `storage/audio/` at
 * the repo root (gitignored) — never used in production.
 */
class LocalStorageService implements StorageService {
  constructor(private baseDir: string) {}

  private fullPath(path: string): string {
    return join(this.baseDir, path);
  }

  async uploadAudio(path: string, wav: Buffer): Promise<void> {
    const full = this.fullPath(path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, wav);
  }

  async downloadAudio(path: string): Promise<Buffer> {
    return readFile(this.fullPath(path));
  }

  async deleteSessionAudio(sessionId: string): Promise<void> {
    await rm(this.fullPath(`sessions/${sessionId.toLowerCase()}`), {
      recursive: true,
      force: true,
    });
  }
}

let instance: StorageService | null = null;

export function getStorageService(): StorageService {
  if (instance) return instance;
  if (storageMode() === 'local') {
    const baseDir = env.LOCAL_AUDIO_DIR
      ? join(process.cwd(), env.LOCAL_AUDIO_DIR)
      : join(repoRoot, 'storage', 'audio');
    instance = new LocalStorageService(baseDir);
  } else {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when STORAGE_MODE=supabase',
      );
    }
    instance = new SupabaseStorageService(
      env.SUPABASE_AUDIO_BUCKET,
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
    );
  }
  return instance;
}

/** Test seam — lets suites swap in an in-memory implementation. */
export function setStorageService(service: StorageService): void {
  instance = service;
}
