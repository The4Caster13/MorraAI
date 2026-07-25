import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { THEMES } from '@morrai/shared';
import { stimulusRepo } from '../db/repositories/index.js';
import { toStimulusDto } from './mappers.js';

const querySchema = z.object({ theme: z.enum(THEMES).optional() });

export const stimulusRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/stimuli', async (req, reply) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const rows = await stimulusRepo.list(parsed.data.theme);
    return rows.map(toStimulusDto);
  });
};
