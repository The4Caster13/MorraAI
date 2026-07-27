import { describe, expect, it } from 'vitest';
import { requireAuth } from './requireAuth.js';
import type { SessionUser } from './session.js';

function fakeReply() {
  const reply = {
    statusCode: 0 as number,
    payload: undefined as unknown,
    code(status: number) {
      reply.statusCode = status;
      return reply;
    },
    send(body: unknown) {
      reply.payload = body;
      return reply;
    },
  };
  return reply;
}

const req = (currentUser: SessionUser | null) => ({ currentUser }) as never;

describe('requireAuth', () => {
  it('passes through when signed in', async () => {
    const reply = fakeReply();
    const user: SessionUser = {
      id: 'u1',
      email: 'a@b.com',
      displayName: 'A',
      emailVerifiedAt: null,
      createdAt: new Date('2026-01-01'),
    };
    await requireAuth(req(user), reply as never);
    expect(reply.statusCode).toBe(0);
  });

  it('rejects with 401 when signed out', async () => {
    const reply = fakeReply();
    await requireAuth(req(null), reply as never);
    expect(reply.statusCode).toBe(401);
  });
});
