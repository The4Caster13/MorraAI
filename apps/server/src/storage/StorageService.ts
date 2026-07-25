import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, storageMode } from '../config/env.js';

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

  constructor(private bucket: string) {
    // Only constructed when storageMode() reports 'supabase', which is exactly
    // the condition that both of these are set.
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SupabaseStorageService requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }
    this.client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
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

/** Repo root — `apps/server/src/storage` → four levels up. */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const localAudioRoot = path.join(repoRoot, 'storage');

class LocalDiskStorageService implements StorageService {
  private resolve(objectPath: string): string {
    // audioPath() builds these, but guard anyway — this joins into a filesystem path.
    const full = path.resolve(localAudioRoot, objectPath);
    if (!full.startsWith(localAudioRoot + path.sep)) {
      throw new Error(`Refusing to write outside the audio directory: ${objectPath}`);
    }
    return full;
  }

  async uploadAudio(objectPath: string, wav: Buffer): Promise<void> {
    const full = this.resolve(objectPath);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, wav);
  }

  async downloadAudio(objectPath: string): Promise<Buffer> {
    return readFile(this.resolve(objectPath));
  }

  async deleteSessionAudio(sessionId: string): Promise<void> {
    const dir = this.resolve(path.join('sessions', sessionId.toLowerCase()));
    await rm(dir, { recursive: true, force: true });
  }
}

let instance: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!instance) {
    instance =
      storageMode() === 'supabase'
        ? new SupabaseStorageService(env.SUPABASE_AUDIO_BUCKET)
        : new LocalDiskStorageService();
  }
  return instance;
}

/** Test seam — lets suites swap in an in-memory implementation. */
export function setStorageService(service: StorageService): void {
  instance = service;
}
