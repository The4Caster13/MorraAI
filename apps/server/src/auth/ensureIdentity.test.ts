import { describe, expect, it, vi } from 'vitest';

const GUEST = {
  id: 'guest-1',
  email: null,
  displayName: 'Guest',
  emailVerifiedAt: null,
  createdAt: new Date('2026-01-01'),
};

vi.mock('../db/repositories/index.js', () => ({
  userRepo: {
    createGuest: vi.fn(async () => GUEST),
  },
}));

vi.mock('./session.js', () => ({
  createSession: vi.fn(async (userId: string) => ({ token: `token-for-${userId}`, expiresAt: new Date() })),
}));

const setSessionCookie = vi.fn();
vi.mock('./plugin.js', () => ({
  setSessionCookie: (...args: unknown[]) => setSessionCookie(...args),
}));

const { ensureIdentity } = await import('./ensureIdentity.js');
const { userRepo } = await import('../db/repositories/index.js');
const { createSession } = await import('./session.js');

function fakeReq(currentUser: unknown = null) {
  return { currentUser, headers: {}, ip: '127.0.0.1' };
}

describe('ensureIdentity', () => {
  it('does nothing when already signed in', async () => {
    const existing = { id: 'u1', email: 'a@b.com' };
    const req = fakeReq(existing);
    await ensureIdentity(req as never, {} as never);
    expect(req.currentUser).toBe(existing);
    expect(userRepo.createGuest).not.toHaveBeenCalled();
  });

  it('provisions a guest identity and sets a session cookie when signed out', async () => {
    const req = fakeReq(null);
    const reply = {} as never;
    await ensureIdentity(req as never, reply);

    expect(userRepo.createGuest).toHaveBeenCalledTimes(1);
    expect(createSession).toHaveBeenCalledWith('guest-1', expect.any(Object));
    expect(setSessionCookie).toHaveBeenCalledWith(reply, 'token-for-guest-1');
    expect(req.currentUser).toMatchObject({ id: 'guest-1', email: null });
  });
});
