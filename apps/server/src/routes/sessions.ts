import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  consentRequestSchema,
  createSessionRequestSchema,
  PART1_SECONDS_CAP,
  PHASES,
  PREP_SECONDS_DEFAULT,
  SPEAKERS,
} from '@morrai/shared';
import { sessionRepo, stimulusRepo, transcriptRepo } from '../db/repositories/index.js';
import { assertTransition, InvalidTransitionError } from '../session/sessionMachine.js';
import { disposeRuntime } from '../session/SessionRuntime.js';
import { getStorageService } from '../storage/StorageService.js';
import { toScoreDto, toSessionDto, toSessionSummaryDto } from './mappers.js';
import { requireAccessCode } from './accessCode.js';
import { requireAuth } from '../auth/requireAuth.js';
import { ensureIdentity } from '../auth/ensureIdentity.js';
import type { SessionUser } from '../auth/session.js';

const CONSENT_TEXT_VERSION = '2026-07-25.v1';

/**
 * Session-scoped reads and deletes must belong to the signed-in caller.
 * `req.currentUser` comes from the auth plugin's session-cookie resolution —
 * this replaces a prior self-asserted `userId` query param, which any client
 * could set to any value.
 */
function requireOwner(
  session: { userId: string },
  currentUser: SessionUser | null,
): { ok: true } | { ok: false; code: 401 | 403; error: string } {
  if (!currentUser) return { ok: false, code: 401, error: 'Not signed in' };
  if (currentUser.id !== session.userId) return { ok: false, code: 403, error: 'Not your session' };
  return { ok: true };
}

export const sessionRoutes: FastifyPluginAsync = async (app) => {
  // ensureIdentity (not requireAuth) — this is the entry point for a guest
  // trying a mock interview with no account at all, so it provisions an
  // identity rather than rejecting one that's missing.
  app.post('/api/sessions', { preHandler: [requireAccessCode, ensureIdentity] }, async (req, reply) => {
    const parsed = createSessionRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { mode, theme, stimulusId, prepSeconds } = parsed.data;
    const userId = req.currentUser!.id;

    const stimulus = stimulusId
      ? await stimulusRepo.findById(stimulusId)
      : await stimulusRepo.pickRandom(theme);
    if (!stimulus) return reply.code(404).send({ error: 'No stimulus available' });

    // Exam mode always uses the real prep time; practice mode may adjust it.
    const prep =
      mode === 'practice' && prepSeconds !== undefined ? prepSeconds : PREP_SECONDS_DEFAULT;

    const session = await sessionRepo.create({
      userId,
      stimulusId: stimulus.id,
      mode,
      prepSecondsAllotted: prep,
      presentationSecondsCap: PART1_SECONDS_CAP,
    });
    return reply.code(201).send(toSessionDto(session));
  });

  app.post('/api/sessions/:id/consent', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = consentRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const session = await sessionRepo.findById(id);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    const owner = requireOwner(session, req.currentUser);
    if (!owner.ok) return reply.code(owner.code).send({ error: owner.error });

    // A browser-back landing on a stale consent screen for a session that has
    // already moved on (or finished) re-submits the same consent the student
    // already gave. That is not a new request to reject with a 409 — it is
    // the same fact restated, so treat it as a no-op and hand back where the
    // session actually is, rather than surfacing an "invalid transition"
    // error the student has no way to act on.
    if (session.status !== 'DRAFT') {
      return toSessionDto(session);
    }

    try {
      assertTransition(session.status as never, 'CONSENTED');
    } catch (err) {
      if (err instanceof InvalidTransitionError)
        return reply.code(409).send({ error: err.message });
      throw err;
    }

    await sessionRepo.recordConsent({
      sessionId: id,
      userId: req.currentUser!.id,
      consentTextVersion: CONSENT_TEXT_VERSION,
      recordingConsent: parsed.data.recordingConsent,
      dataRetentionAcknowledged: parsed.data.dataRetentionAcknowledged,
    });
    const updated = await sessionRepo.update(id, { status: 'CONSENTED' });
    return toSessionDto(updated);
  });

  app.get('/api/sessions/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = await sessionRepo.findById(id);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    const owner = requireOwner(session, req.currentUser);
    if (!owner.ok) return reply.code(owner.code).send({ error: owner.error });
    return {
      ...toSessionDto(session),
      score: session.score ? toScoreDto(session.score) : null,
    };
  });

  app.get('/api/sessions/:id/transcript', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = await sessionRepo.findById(id);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    const owner = requireOwner(session, req.currentUser);
    if (!owner.ok) return reply.code(owner.code).send({ error: owner.error });
    const segments = await transcriptRepo.listBySession(id);
    return segments.map((s) => ({
      id: s.id,
      phase: s.phase,
      speaker: s.speaker,
      text: s.text,
      startMs: s.startMs,
      endMs: s.endMs,
      sttConfidence: s.sttConfidence,
    }));
  });

  app.get('/api/sessions', { preHandler: requireAuth }, async (req) => {
    const rows = await sessionRepo.listByUser(req.currentUser!.id);
    return rows.map(toSessionSummaryDto);
  });

  app.delete('/api/sessions/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = await sessionRepo.findById(id);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    const owner = requireOwner(session, req.currentUser);
    if (!owner.ok) return reply.code(owner.code).send({ error: owner.error });
    await disposeRuntime(id);
    await getStorageService()
      .deleteSessionAudio(id)
      .catch((err) => req.log.error({ err }, 'audio deletion failed'));
    await sessionRepo.delete(id);
    return reply.code(204).send();
  });

  app.get('/api/sessions/:id/audio/:phase/:speaker', { preHandler: requireAuth }, async (req, reply) => {
    const params = z
      .object({
        id: z.string().uuid(),
        phase: z.enum(PHASES),
        speaker: z.enum(SPEAKERS),
      })
      .safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: params.error.flatten() });
    const { id, phase, speaker } = params.data;
    const session = await sessionRepo.findById(id);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    const owner = requireOwner(session, req.currentUser);
    if (!owner.ok) return reply.code(owner.code).send({ error: owner.error });
    const file = await transcriptRepo.findAudioFile(id, phase, speaker);
    if (!file) return reply.code(404).send({ error: 'Audio not found' });
    const wav = await getStorageService().downloadAudio(file.filePath);
    return reply.header('Content-Type', 'audio/wav').send(wav);
  });
};
