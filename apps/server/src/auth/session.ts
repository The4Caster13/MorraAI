import { authSessionRepo as defaultAuthSessionRepo } from '../db/repositories/index.js';
import { generateOpaqueToken, hashToken } from './tokens.js';

export const SESSION_COOKIE_NAME = 'morrai_session';
/** Absolute expiry set at issuance — not sliding-refreshed on every request. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string | null;
  displayName: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

/**
 * Only the shape this module actually calls — deliberately not `typeof
 * authSessionRepo`, since Prisma's fluent client types (returned by the real
 * repo) are far more specific than any test fake needs to reproduce.
 */
interface AuthSessionRepo {
  create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string | null;
    ipAddress?: string | null;
  }): Promise<unknown>;
  findByTokenHash(tokenHash: string): Promise<{
    tokenHash: string;
    expiresAt: Date;
    user: SessionUser;
  } | null>;
  deleteByTokenHash(tokenHash: string): Promise<unknown>;
  deleteAllForUser(userId: string): Promise<unknown>;
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ipAddress?: string | null } = {},
  repo: AuthSessionRepo = defaultAuthSessionRepo,
): Promise<{ token: string; expiresAt: Date }> {
  const { token, tokenHash } = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await repo.create({
    userId,
    tokenHash,
    expiresAt,
    userAgent: meta.userAgent ?? null,
    ipAddress: meta.ipAddress ?? null,
  });
  return { token, expiresAt };
}

/** Resolves a cookie value to its user, or null if absent/unknown/expired. */
export async function verifySessionToken(
  token: string,
  repo: AuthSessionRepo = defaultAuthSessionRepo,
): Promise<SessionUser | null> {
  const record = await repo.findByTokenHash(hashToken(token));
  if (!record) return null;
  if (record.expiresAt.getTime() < Date.now()) {
    await repo.deleteByTokenHash(record.tokenHash);
    return null;
  }
  return {
    id: record.user.id,
    email: record.user.email,
    displayName: record.user.displayName,
    emailVerifiedAt: record.user.emailVerifiedAt,
    createdAt: record.user.createdAt,
  };
}

export async function revokeSession(
  token: string,
  repo: AuthSessionRepo = defaultAuthSessionRepo,
): Promise<void> {
  await repo.deleteByTokenHash(hashToken(token));
}

/** Used on password reset, since a reset plausibly means a compromised session. */
export async function revokeAllSessionsForUser(
  userId: string,
  repo: AuthSessionRepo = defaultAuthSessionRepo,
): Promise<void> {
  await repo.deleteAllForUser(userId);
}
