import { buildApp } from './app.js';
import { env, examinerMode } from './config/env.js';
import { sessionRepo } from './db/repositories/index.js';

const app = await buildApp();

// In-flight sessions cannot survive a restart (runtime state is in-memory only).
const stale = await sessionRepo.markStaleActiveSessionsErrored();
if (stale.count > 0) {
  app.log.warn(`Marked ${stale.count} interrupted session(s) as ERROR after restart`);
}

await app.listen({ port: env.PORT, host: '0.0.0.0' });
app.log.info(`Parlons server ready — examiner mode: ${examinerMode()}`);
