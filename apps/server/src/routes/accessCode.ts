import type { FastifyReply, FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

export const ACCESS_CODE_HEADER = 'x-access-code';
/** The client watches for this to know it should prompt, rather than guessing from the status. */
export const ACCESS_CODE_REQUIRED = 'ACCESS_CODE_REQUIRED';

/**
 * Constant-time comparison, so the number of correct leading characters can't
 * be inferred from response timing. Overkill for a shared demo password, but
 * it costs nothing and the habit is worth keeping.
 */
function matches(supplied: string, expected: string): boolean {
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Guards the endpoints that cost money.
 *
 * Only session creation is gated: a WebSocket needs a session id that already
 * exists and passes the ownership check, so gating creation closes the whole
 * path to Gemini without putting a password in front of every request.
 *
 * This is a shared password, not authentication — it stops strangers and
 * crawlers, not someone the code was given to.
 */
export async function requireAccessCode(req: FastifyRequest, reply: FastifyReply) {
  if (!env.ACCESS_CODE) return; // Unset: open, as in local development.

  const supplied = req.headers[ACCESS_CODE_HEADER];
  const value = Array.isArray(supplied) ? supplied[0] : supplied;

  if (!value || !matches(value, env.ACCESS_CODE)) {
    return reply.code(401).send({
      error: 'This app is invite-only. Enter the access code to continue.',
      code: ACCESS_CODE_REQUIRED,
    });
  }
}
