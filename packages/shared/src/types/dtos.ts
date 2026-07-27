import { z } from 'zod';
import {
  THEMES,
  SESSION_MODES,
  SESSION_STATUSES,
  PHASES,
  SPEAKERS,
  MAX_NOTEPAD_BULLETS,
} from './enums.js';

export const stimulusSchema = z.object({
  id: z.string(),
  theme: z.enum(THEMES),
  subtopic: z.string(),
  imageUrl: z.string(),
  captionFr: z.string(),
  culturalLinkFr: z.string(),
  attribution: z.string(),
  licenseName: z.string(),
  sourceUrl: z.string(),
});
export type StimulusDto = z.infer<typeof stimulusSchema>;

export const notepadBulletsSchema = z.array(z.string().max(300)).max(MAX_NOTEPAD_BULLETS);

export const sessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  stimulus: stimulusSchema,
  mode: z.enum(SESSION_MODES),
  status: z.enum(SESSION_STATUSES),
  currentPhase: z.enum(PHASES).nullable(),
  prepSecondsAllotted: z.number().int(),
  presentationSecondsCap: z.number().int(),
  notepadBullets: notepadBulletsSchema.nullable(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type SessionDto = z.infer<typeof sessionSchema>;

export const transcriptSegmentSchema = z.object({
  id: z.string(),
  phase: z.enum(PHASES),
  speaker: z.enum(SPEAKERS),
  text: z.string(),
  startMs: z.number().int(),
  endMs: z.number().int(),
  sttConfidence: z.number().nullable(),
});
export type TranscriptSegmentDto = z.infer<typeof transcriptSegmentSchema>;

export const criterionResultSchema = z.object({
  mark: z.number().int().min(0),
  band: z.string(),
  justification: z.string(),
  evidenceQuotes: z.array(z.string()).min(1),
});
export type CriterionResult = z.infer<typeof criterionResultSchema>;

/** How the student sounded — assessed from the recording, not the transcript. */
export const deliverySchema = z.object({
  audioAssessed: z.boolean(),
  pronunciation: z.string(),
  intonation: z.string(),
  fluency: z.string(),
  pace: z.string(),
  observations: z.array(z.string()),
});
export type DeliveryDto = z.infer<typeof deliverySchema>;

export const scoreSchema = z.object({
  sessionId: z.string(),
  delivery: deliverySchema.nullable(),
  criterionA: criterionResultSchema,
  criterionB1: criterionResultSchema,
  criterionB2: criterionResultSchema,
  criterionC: criterionResultSchema,
  total: z.number().int().min(0).max(30),
  strengths: z.array(z.string()).length(3),
  priorities: z.array(z.string()).length(3),
  drills: z.array(z.string()),
  uncertaintyNote: z.string().nullable(),
  disclaimer: z.string(),
  scoredAt: z.string(),
});
export type ScoreDto = z.infer<typeof scoreSchema>;

export const sessionSummarySchema = z.object({
  id: z.string(),
  mode: z.enum(SESSION_MODES),
  status: z.enum(SESSION_STATUSES),
  theme: z.enum(THEMES),
  stimulusCaption: z.string(),
  createdAt: z.string(),
  marks: z
    .object({
      A: z.number().int(),
      B1: z.number().int(),
      B2: z.number().int(),
      C: z.number().int(),
      total: z.number().int(),
    })
    .nullable(),
});
export type SessionSummaryDto = z.infer<typeof sessionSummarySchema>;

export const createSessionRequestSchema = z.object({
  mode: z.enum(SESSION_MODES),
  theme: z.enum(THEMES).optional(),
  stimulusId: z.string().optional(),
  prepSeconds: z.number().int().min(0).max(3600).optional(),
});
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;

export const consentRequestSchema = z.object({
  recordingConsent: z.literal(true),
  dataRetentionAcknowledged: z.literal(true),
  consentTextVersion: z.string(),
});
export type ConsentRequest = z.infer<typeof consentRequestSchema>;

export const signUpRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  displayName: z.string().min(1).max(60),
});
export type SignUpRequest = z.infer<typeof signUpRequestSchema>;

export const signInRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type SignInRequest = z.infer<typeof signInRequestSchema>;

export const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});
export type RequestPasswordReset = z.infer<typeof requestPasswordResetSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;

export const verifyEmailRequestSchema = z.object({
  token: z.string().min(1),
});
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;

export const currentUserSchema = z.object({
  id: z.string(),
  // Null identifies a guest — someone using the app without an account yet
  // (see ensureIdentity on the server). Signing up or signing in folds their
  // data into a real account, which always has an email.
  email: z.string().nullable(),
  displayName: z.string(),
  emailVerified: z.boolean(),
  createdAt: z.string(),
});
export type CurrentUserDto = z.infer<typeof currentUserSchema>;
