import type { FastifyReply, FastifyRequest } from 'fastify';

/** Gates a route behind a signed-in session. Run after the auth plugin's `onRequest` hook. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  if (!req.currentUser) {
    return reply.code(401).send({ error: 'Not signed in' });
  }
}
