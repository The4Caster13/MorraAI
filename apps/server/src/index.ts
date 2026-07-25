import { buildApp } from './app.js';
import { env, examinerMode, storageMode } from './config/env.js';
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

// Warn about configuration that is fine locally but wrong once deployed.
if (env.NODE_ENV === 'production') {
  if (storageMode() === 'local') {
    app.log.warn(
      'Audio is being written to the container filesystem, which most hosts wipe on every ' +
        'deploy and restart. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to keep recordings.',
    );
  }
  if (!env.ACCESS_CODE) {
    app.log.warn(
      'ACCESS_CODE is not set, so anyone who finds this URL can start sessions against your ' +
        'Gemini key. Set it unless the deployment is deliberately public.',
    );
  }
}

await app.listen({ port: env.PORT, host: '0.0.0.0' });
app.log.info(
  `Morrai server ready — examiner: ${examinerMode()}, audio storage: ${
    storageMode() === 'local' ? 'local disk (storage/)' : 'Supabase'
  }`,
);
