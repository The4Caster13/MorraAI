import { z } from 'zod';
import { PHASES } from './enums.js';
import { notepadBulletsSchema, sessionSchema, stimulusSchema } from './dtos.js';

// ---- Client → Server ----

export const wsClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('client:ready') }),
  z.object({ type: z.literal('client:startPhase'), phase: z.enum(PHASES) }),
  z.object({
    type: z.literal('client:audioChunk'),
    phase: z.enum(PHASES),
    seq: z.number().int(),
    pcm16Base64: z.string(),
    sampleRate: z.literal(16000),
  }),
  z.object({ type: z.literal('client:requestRephrase') }),
  z.object({ type: z.literal('client:notepadUpdate'), bullets: notepadBulletsSchema }),
  z.object({ type: z.literal('client:skipPrep') }),
  z.object({ type: z.literal('client:endSessionEarly') }),
  z.object({ type: z.literal('client:toggleTextMode'), show: z.boolean() }),
  // Mock-mode only: lets a developer "speak" by typing when no STT backend exists.
  z.object({ type: z.literal('client:debugStudentText'), phase: z.enum(PHASES), text: z.string() }),
]);
export type WsClientMessage = z.infer<typeof wsClientMessageSchema>;

// ---- Server → Client ----

export const wsServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('server:snapshot'), session: sessionSchema }),
  z.object({
    type: z.literal('server:phaseChanged'),
    phase: z.enum(PHASES).nullable(),
    status: sessionSchema.shape.status,
  }),
  z.object({
    type: z.literal('server:timerTick'),
    phase: z.enum(PHASES).nullable(),
    remainingMs: z.number().int(),
  }),
  z.object({ type: z.literal('server:stimulusReveal'), stimulus: stimulusSchema }),
  z.object({
    type: z.literal('server:examinerAudioChunk'),
    seq: z.number().int(),
    pcm16Base64: z.string(),
    sampleRate: z.literal(24000),
  }),
  z.object({ type: z.literal('server:examinerInterrupted') }),
  z.object({ type: z.literal('server:questionText'), text: z.string() }),
  z.object({
    type: z.literal('server:studentTranscript'),
    phase: z.enum(PHASES),
    text: z.string(),
    isFinal: z.boolean(),
    confidence: z.number().nullable(),
  }),
  z.object({ type: z.literal('server:part1HardStop') }),
  z.object({
    type: z.literal('server:error'),
    code: z.string(),
    message: z.string(),
    recoverable: z.boolean(),
  }),
  z.object({ type: z.literal('server:sessionComplete'), sessionId: z.string() }),
]);
export type WsServerMessage = z.infer<typeof wsServerMessageSchema>;
