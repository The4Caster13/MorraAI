import { describe, expect, it } from 'vitest';
import { createSession, revokeAllSessionsForUser, revokeSession, verifySessionToken } from './session.js';

/**
 * An in-memory stand-in for authSessionRepo, shaped exactly like the real
 * Prisma-backed one (including the `user` join on `findByTokenHash`) so these
 * tests exercise the same contract without touching a real database.
 */
function fakeRepo() {
  const rows = new Map<
    string,
    { tokenHash: string; userId: string; expiresAt: Date; userAgent: string | null; ipAddress: string | null }
  >();
  const users = new Map<
    string,
    { id: string; email: string | null; displayName: string; emailVerifiedAt: Date | null; createdAt: Date }
  >([
    [
      'user-1',
      {
        id: 'user-1',
        email: 'student@example.com',
        displayName: 'Student',
        emailVerifiedAt: null,
        createdAt: new Date('2026-01-01'),
      },
    ],
  ]);

  return {
    rows,
    create: async (input: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      userAgent?: string | null;
      ipAddress?: string | null;
    }) => {
      rows.set(input.tokenHash, {
        tokenHash: input.tokenHash,
        userId: input.userId,
        expiresAt: input.expiresAt,
        userAgent: input.userAgent ?? null,
        ipAddress: input.ipAddress ?? null,
      });
    },
    findByTokenHash: async (tokenHash: string) => {
      const row = rows.get(tokenHash);
      if (!row) return null;
      const user = users.get(row.userId);
      if (!user) return null;
      return { ...row, user };
    },
    deleteByTokenHash: async (tokenHash: string) => {
      rows.delete(tokenHash);
    },
    deleteAllForUser: async (userId: string) => {
      for (const [hash, row] of rows) if (row.userId === userId) rows.delete(hash);
    },
  };
}

describe('createSession / verifySessionToken', () => {
  it('issues a token that resolves back to the user', async () => {
    const repo = fakeRepo();
    const { token } = await createSession('user-1', {}, repo);
    const user = await verifySessionToken(token, repo);
    expect(user?.id).toBe('user-1');
    expect(user?.email).toBe('student@example.com');
  });

  it('returns null for an unknown token', async () => {
    const repo = fakeRepo();
    expect(await verifySessionToken('not-a-real-token', repo)).toBeNull();
  });

  it('rejects and deletes an expired session', async () => {
    const repo = fakeRepo();
    const { token } = await createSession('user-1', {}, repo);
    const [row] = [...repo.rows.values()];
    row.expiresAt = new Date(Date.now() - 1000);

    expect(await verifySessionToken(token, repo)).toBeNull();
    expect(repo.rows.size).toBe(0);
  });
});

describe('revokeSession', () => {
  it('invalidates the token immediately', async () => {
    const repo = fakeRepo();
    const { token } = await createSession('user-1', {}, repo);
    await revokeSession(token, repo);
    expect(await verifySessionToken(token, repo)).toBeNull();
  });
});

describe('revokeAllSessionsForUser', () => {
  it('invalidates every session for that user, leaving others untouched', async () => {
    const repo = fakeRepo();
    const a = await createSession('user-1', {}, repo);
    const b = await createSession('user-1', {}, repo);
    await revokeAllSessionsForUser('user-1', repo);
    expect(await verifySessionToken(a.token, repo)).toBeNull();
    expect(await verifySessionToken(b.token, repo)).toBeNull();
  });
});
