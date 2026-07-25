import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  consentRequestSchema,
  createSessionRequestSchema,
  PHASES,
  PREP_SECONDS_DEFAULT,
  SPEAKERS,
} from '@parlons/shared';
import { sessionRepo, stimulusRepo, transcriptRepo, userRepo } from '../db/repositories/index.js';
import { assertTransition, InvalidTransitionError } from '../session/sessionMachine.js';
import { disposeRuntime } from '../session/SessionRuntime.js';
import { getStorageService } from '../storage/StorageService.js';
import { toScoreDto, toSessionDto, toSessionSummaryDto } from './mappers.js';

const CONSENT_TEXT_VERSION = '2026-07-25.v1';

const callerSchema = z.object({ userId: z.string().uuid() });

/**
 * Session-scoped reads and deletes must name their caller.
 *
 * NOTE: this is ownership, not authentication. `userId` is still a
 * self-asserted UUID from the browser, so it stops a leaked or guessed session
 * ID from exposing another student's recording, but it does not stop someone
 * who already knows a userId. Replacing this with real signed sessions is a
 * prerequisite for handling minors' voice data in production.
 */
function requireOwner(
  session: { userId: string },
  query: unknown,
): { ok: true; userId: string } | { ok: false; code: 400 | 403; error: unknown } {
  const parsed = callerSchema.safeParse(query);
  if (!parsed.success) return { ok: false, code: 400, error: parsed.error.flatten() };
  if (parsed.data.userId !== session.userId)
    return { ok: false, code: 403, error: 'Not your session' };
  return { ok: true, userId: parsed.data.userId };
}

export const sessionRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/sessions', async (req, reply) => {
    const parsed = createSessionRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { userId, mode, theme, stimulusId, prepSeconds } = parsed.data;

    const user = await userRepo.findById(userId);
    if (!user) return reply.code(404).send({ error: 'User not found' });

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
    });
    return reply.code(201).send(toSessionDto(session));
  });

  app.post('/api/sessions/:id/consent', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = consentRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const session = await sessionRepo.findById(id);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    if (session.userId !== parsed.data.userId)
      return reply.code(403).send({ error: 'Not your session' });

    try {
      assertTransition(session.status as never, 'CONSENTED');
    } catch (err) {
      if (err instanceof InvalidTransitionError)
        return reply.code(409).send({ error: err.message });
      throw err;
    }

    await sessionRepo.recordConsent({
      sessionId: id,
      userId: parsed.data.userId,
      consentTextVersion: CONSENT_TEXT_VERSION,
      recordingConsent: parsed.data.recordingConsent,
      dataRetentionAcknowledged: parsed.data.dataRetentionAcknowledged,
    });
    const updated = await sessionRepo.update(id, { status: 'CONSENTED' });
    return toSessionDto(updated);
  });

  app.get('/api/sessions/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = await sessionRepo.findById(id);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    const owner = requireOwner(session, req.query);
    if (!owner.ok) return reply.code(owner.code).send({ error: owner.error });
    return {
      ...toSessionDto(session),
      score: session.score ? toScoreDto(session.score) : null,
    };
  });

  app.get('/api/sessions/:id/transcript', async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = await sessionRepo.findById(id);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    const owner = requireOwner(session, req.query);
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

  app.get('/api/sessions', async (req, reply) => {
    const parsed = z.object({ userId: z.string().uuid() }).safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const rows = await sessionRepo.listByUser(parsed.data.userId);
    return rows.map(toSessionSummaryDto);
  });

  app.delete('/api/sessions/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = await sessionRepo.findById(id);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    const owner = requireOwner(session, req.query);
    if (!owner.ok) return reply.code(owner.code).send({ error: owner.error });
    await disposeRuntime(id);
    await getStorageService()
      .deleteSessionAudio(id)
      .catch((err) => req.log.error({ err }, 'audio deletion failed'));
    await sessionRepo.delete(id);
    return reply.code(204).send();
  });

  app.get('/api/sessions/:id/audio/:phase/:speaker', async (req, reply) => {
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
    const owner = requireOwner(session, req.query);
    if (!owner.ok) return reply.code(owner.code).send({ error: owner.error });
    const file = await transcriptRepo.findAudioFile(id, phase, speaker);
    if (!file) return reply.code(404).send({ error: 'Audio not found' });
    const wav = await getStorageService().downloadAudio(file.filePath);
    return reply.header('Content-Type', 'audio/wav').send(wav);
  });
};
