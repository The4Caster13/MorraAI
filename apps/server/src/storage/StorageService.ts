import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

/**
 * Session audio storage.
 *
 * Audio is student voice data — often from minors — so it lives in a *private*
 * Supabase bucket reached only with the service-role key from the backend. The
 * browser never gets a storage URL; it fetches audio through
 * `GET /api/sessions/:id/audio/...`, which applies ownership checks first.
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

let instance: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!instance) instance = new SupabaseStorageService(env.SUPABASE_AUDIO_BUCKET);
  return instance;
}

/** Test seam — lets suites swap in an in-memory implementation. */
export function setStorageService(service: StorageService): void {
  instance = service;
}
