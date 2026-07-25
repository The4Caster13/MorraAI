import { buildApp } from './app.js';
import { env, examinerMode } from './config/env.js';
import { hintForError } from './errorHint.js';
import { sessionRepo, stimulusRepo } from './db/repositories/index.js';

const app = await buildApp();

// Fail at boot rather than on the student's first click — otherwise every one
// of these surfaces as an opaque 500 or 404 in the browser.
try {
  // In-flight sessions cannot survive a restart (runtime state is in-memory only).
  const stale = await sessionRepo.markStaleActiveSessionsErrored();
  if (stale.count > 0) {
    app.log.warn(`Marked ${stale.count} interrupted session(s) as ERROR after restart`);
  }

  const stimulusCount = (await stimulusRepo.list()).length;
  if (stimulusCount === 0) {
    app.log.error(
      'No stimuli in the database — every session will fail to start.\n' +
        '  → Run: npm run db:seed --workspace=apps/server\n',
    );
  } else {
    app.log.info(`${stimulusCount} stimuli available`);
  }
} catch (err) {
  app.log.error({ err }, 'Database check failed at startup');
  const hint = hintForError(err);
  if (hint) app.log.error(`\n  → ${hint}\n`);
  process.exit(1);
}

await app.listen({ port: env.PORT, host: '0.0.0.0' });
app.log.info(`Parlons server ready — examiner mode: ${examinerMode()}`);
