import { createHash, randomBytes } from 'node:crypto';

/**
 * A random opaque value plus its hash, used for both session cookies and
 * verify/reset links. Only `tokenHash` is ever persisted — the raw `token` is
 * handed to the client (as a cookie or a URL) and never stored, so a DB dump
 * can't be replayed as a live cookie or a live reset link.
 */
export interface OpaqueToken {
  token: string;
  tokenHash: string;
}

export function generateOpaqueToken(): OpaqueToken {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
