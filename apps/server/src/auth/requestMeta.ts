import type { FastifyRequest } from 'fastify';

/** Metadata worth recording against a session row, pulled from the request that created it. */
export function sessionMeta(req: FastifyRequest) {
  return { userAgent: req.headers['user-agent'] ?? null, ipAddress: req.ip };
}
