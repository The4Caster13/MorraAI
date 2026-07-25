import type { FastifyPluginAsync } from 'fastify';
import { createUserRequestSchema } from '@parlons/shared';
import { userRepo } from '../db/repositories/index.js';

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/users', async (req, reply) => {
    const parsed = createUserRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const user = await userRepo.upsert(parsed.data.id, parsed.data.displayName);
    return { id: user.id, displayName: user.displayName };
  });
};
