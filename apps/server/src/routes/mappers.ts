import type { Prisma } from '@prisma/client';
import type { ScoreDto, SessionDto, SessionSummaryDto, StimulusDto } from '@parlons/shared';
import { DISCLAIMER_FR, notepadBulletsSchema } from '@parlons/shared';

type StimulusRow = Prisma.StimulusGetPayload<object>;
type SessionRow = Prisma.SessionGetPayload<{ include: { stimulus: true } }>;
type SessionWithScore = Prisma.SessionGetPayload<{ include: { stimulus: true; score: true } }>;
type ScoreRow = Prisma.ScoreGetPayload<object>;

export function toStimulusDto(s: StimulusRow): StimulusDto {
  return {
    id: s.id,
    theme: s.theme as StimulusDto['theme'],
    subtopic: s.subtopic,
    imageUrl: `/stimuli-images/${s.imagePath}`,
    captionFr: s.captionFr,
    culturalLinkFr: s.culturalLinkFr,
    attribution: s.attribution,
    licenseName: s.licenseName,
    sourceUrl: s.sourceUrl,
  };
}

export function toSessionDto(s: SessionRow): SessionDto {
  const bullets = notepadBulletsSchema.nullable().safeParse(s.notepadBullets);
  return {
    id: s.id,
    userId: s.userId,
    stimulus: toStimulusDto(s.stimulus),
    mode: s.mode as SessionDto['mode'],
    status: s.status as SessionDto['status'],
    currentPhase: s.currentPhase as SessionDto['currentPhase'],
    prepSecondsAllotted: s.prepSecondsAllotted,
    presentationSecondsCap: s.presentationSecondsCap,
    notepadBullets: bullets.success ? bullets.data : null,
    startedAt: s.startedAt?.toISOString() ?? null,
    endedAt: s.endedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}

export function toSessionSummaryDto(s: SessionWithScore): SessionSummaryDto {
  return {
    id: s.id,
    mode: s.mode as SessionSummaryDto['mode'],
    status: s.status as SessionSummaryDto['status'],
    theme: s.stimulus.theme as SessionSummaryDto['theme'],
    stimulusCaption: s.stimulus.captionFr,
    createdAt: s.createdAt.toISOString(),
    marks: s.score
      ? {
          A: s.score.criterionA,
          B1: s.score.criterionB1,
          B2: s.score.criterionB2,
          C: s.score.criterionC,
          total: s.score.total,
        }
      : null,
  };
}

export function toScoreDto(score: ScoreRow): ScoreDto {
  const rationale = score.rationaleJson as Record<string, unknown>;
  return {
    sessionId: score.sessionId,
    criterionA: rationale.A as ScoreDto['criterionA'],
    criterionB1: rationale.B1 as ScoreDto['criterionB1'],
    criterionB2: rationale.B2 as ScoreDto['criterionB2'],
    criterionC: rationale.C as ScoreDto['criterionC'],
    total: score.total,
    strengths: score.strengthsJson as ScoreDto['strengths'],
    priorities: score.prioritiesJson as ScoreDto['priorities'],
    drills: score.drillsJson as ScoreDto['drills'],
    uncertaintyNote: score.confidenceNote,
    disclaimer: DISCLAIMER_FR,
    scoredAt: score.scoredAt.toISOString(),
  };
}
