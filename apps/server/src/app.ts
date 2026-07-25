import { createReadStream, existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { env, examinerMode } from './config/env.js';
import { hintForError } from './errorHint.js';
import { userRoutes } from './routes/users.js';
import { stimulusRoutes } from './routes/stimuli.js';
import { sessionRoutes } from './routes/sessions.js';
import { wsGateway } from './ws/gateway.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const stimuliImageDir = join(repoRoot, 'data', 'stimuli', 'images');
const webDistDir = join(repoRoot, 'apps', 'web', 'dist');

export async function buildApp() {
  const app = Fastify({ logger: true });

  // Fastify's default handler returns a bare 500 with no detail, which makes
  // configuration problems (unreachable database, missing table, pooler
  // rejecting prepared statements) indistinguishable from application bugs.
  app.setErrorHandler((err: FastifyError, req, reply) => {
    const hint = hintForError(err);
    req.log.error({ err, hint }, 'request failed');
    if (hint) req.log.error(`\n  → ${hint}\n`);

    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    // Error internals stay server-side in production; in development the
    // message is the whole point.
    if (env.NODE_ENV === 'production' && status >= 500) {
      return reply.code(status).send({ error: 'Internal server error' });
    }
    return reply.code(status).send({
      error: err.message || 'Internal server error',
      ...(hint ? { hint } : {}),
    });
  });

  // In development the Vite dev server proxies to this origin, so it must be
  // allowed explicitly. In production the SPA is served from this same origin
  // (see the static handler below), so no cross-origin access is needed.
  await app.register(cors, {
    origin: env.NODE_ENV === 'production' ? false : env.DEV_WEB_ORIGIN,
    credentials: true,
  });
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

  // Production runs as a single service: the built SPA is served from the same
  // origin as the API, so there is no proxy or CORS configuration to get wrong.
  // Unknown non-API paths fall through to index.html for client-side routing.
  if (env.NODE_ENV === 'production' && existsSync(webDistDir)) {
    await app.register(fastifyStatic, { root: webDistDir });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api') || req.url.startsWith('/ws')) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}
