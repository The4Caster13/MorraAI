import { createReadStream, existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { examinerMode } from './config/env.js';
import { userRoutes } from './routes/users.js';
import { stimulusRoutes } from './routes/stimuli.js';
import { sessionRoutes } from './routes/sessions.js';
import { wsGateway } from './ws/gateway.js';

const stimuliImageDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'data',
  'stimuli',
  'images',
);

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  app.get('/api/health', async () => ({
    status: 'ok',
    examinerMode: examinerMode(),
  }));

  // Placeholder stimulus images are served straight from the repo's data folder.
  app.get('/stimuli-images/:file', async (req, reply) => {
    const { file } = req.params as { file: string };
    if (normalize(file).includes('..') || file.includes('/')) {
      return reply.code(400).send({ error: 'Invalid file name' });
    }
    const path = join(stimuliImageDir, file);
    if (!existsSync(path)) return reply.code(404).send({ error: 'Not found' });
    const contentType = file.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg';
    return reply.header('Content-Type', contentType).send(createReadStream(path));
  });

  await app.register(userRoutes);
  await app.register(stimulusRoutes);
  await app.register(sessionRoutes);
  await app.register(wsGateway);

  return app;
}
