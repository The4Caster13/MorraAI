import cookie from '@fastify/cookie';
import type { FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { env } from '../config/env.js';
import { SESSION_COOKIE_NAME, SESSION_TTL_MS, verifySessionToken, type SessionUser } from './session.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** The signed-in user for this request, or null if signed out. Always
     * set (never undefined) — resolved once per request by this plugin's
     * `onRequest` hook, before any route's own preHandler runs. */
    currentUser: SessionUser | null;
  }
}

/** Cookie flags live in one place so a later cross-origin deployment only needs to change them here. */
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.NODE_ENV === 'production',
    path: '/',
  };
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    ...cookieOptions(),
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME, cookieOptions());
}

/**
 * Resolves `req.currentUser` for every request, authenticated or not — `GET
 * /api/auth/me` and the unverified-email banner both need to answer "signed
 * out" rather than reject. Wrapped with fastify-plugin so the decorator and
 * hook apply globally instead of only within this plugin's own encapsulation
 * context.
 */
export const authPlugin = fp(async (app) => {
  await app.register(cookie);
  app.decorateRequest('currentUser', null);

  app.addHook('onRequest', async (req) => {
    const token = req.cookies[SESSION_COOKIE_NAME];
    req.currentUser = token ? await verifySessionToken(token) : null;
  });
});
