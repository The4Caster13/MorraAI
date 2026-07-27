import type { FastifyReply, FastifyRequest } from 'fastify';
import { userRepo } from '../db/repositories/index.js';
import { createSession } from './session.js';
import { setSessionCookie } from './plugin.js';
import { sessionMeta } from './requestMeta.js';

/**
 * Lets a route work for a signed-in user AND for someone with no account at
 * all — a guest starting a mock interview straight from the landing page.
 * If there's no session cookie yet, this provisions a no-email `User` row and
 * a real session cookie for it on the spot, so everything downstream (WS
 * ownership checks, GET/DELETE on the session, `requireAuth` on later
 * requests) works exactly as it does for a signed-in user. Signing up or
 * signing in later folds this guest identity into the real account — see
 * routes/auth.ts.
 */
export async function ensureIdentity(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (req.currentUser) return;

  const guest = await userRepo.createGuest();
  const { token } = await createSession(guest.id, sessionMeta(req));
  setSessionCookie(reply, token);
  req.currentUser = {
    id: guest.id,
    email: guest.email,
    displayName: guest.displayName,
    emailVerifiedAt: guest.emailVerifiedAt,
    createdAt: guest.createdAt,
  };
}
