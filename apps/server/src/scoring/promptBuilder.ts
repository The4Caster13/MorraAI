import { z } from 'zod';
import type { ScoreSessionInput } from '../examiner/ExaminerService.js';
import { CRITERIA_DESCRIPTIONS, SCORING_PERSONA } from './rubricDescriptors.js';

const criterionResultSchema = z.object({
  mark: z.number().int().min(0),
  band: z.enum(['Emerging', 'Developing', 'Proficient', 'Strong']),
  justification: z.string().min(1),
  evidenceQuotes: z.array(z.string()).min(1),
});

export const scoringResponseSchema = z.object({
  criterionA: criterionResultSchema.extend({ mark: z.number().int().min(0).max(12) }),
  criterionB1: criterionResultSchema.extend({ mark: z.number().int().min(0).max(6) }),
  criterionB2: criterionResultSchema.extend({ mark: z.number().int().min(0).max(6) }),
  criterionC: criterionResultSchema.extend({ mark: z.number().int().min(0).max(6) }),
  strengths: z.array(z.string()).length(3),
  priorities: z.array(z.string()).length(3),
  drills: z.array(z.string()).min(1).max(5),
  uncertaintyNote: z.string().nullable(),
});
export type ScoringResponse = z.infer<typeof scoringResponseSchema>;

// Gemini responseSchema (OpenAPI-subset format) mirroring scoringResponseSchema.
const criterionJsonSchema = (max: number) => ({
  type: 'object',
  properties: {
    mark: { type: 'integer', minimum: 0, maximum: max },
    band: { type: 'string', enum: ['Emerging', 'Developing', 'Proficient', 'Strong'] },
    justification: { type: 'string' },
    evidenceQuotes: { type: 'array', items: { type: 'string' }, minItems: 1 },
  },
  required: ['mark', 'band', 'justification', 'evidenceQuotes'],
});

export const scoringResponseJsonSchema = {
  type: 'object',
  properties: {
    criterionA: criterionJsonSchema(12),
    criterionB1: criterionJsonSchema(6),
    criterionB2: criterionJsonSchema(6),
    criterionC: criterionJsonSchema(6),
    strengths: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
    priorities: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
    drills: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
    uncertaintyNote: { type: 'string', nullable: true },
  },
  required: [
    'criterionA',
    'criterionB1',
    'criterionB2',
    'criterionC',
    'strengths',
    'priorities',
    'drills',
    'uncertaintyNote',
  ],
};

export function buildScoringPrompt(input: ScoreSessionInput): string {
  const transcriptLines = input.fullTranscript
    .map((seg) => {
      const who = seg.speaker === 'STUDENT' ? 'ÉTUDIANT' : 'EXAMINATEUR';
      const lowConf =
        seg.id && input.sttConfidenceSummary.lowConfidenceSegmentIds.includes(seg.id)
          ? ' [transcription incertaine]'
          : '';
      return `[${seg.phase}] ${who}${lowConf} : ${seg.text}`;
    })
    .join('\n');

  const confidenceNote =
    input.sttConfidenceSummary.avg !== null
      ? `Confiance moyenne de transcription : ${Math.round(input.sttConfidenceSummary.avg * 100)}%. ${
          input.sttConfidenceSummary.lowConfidenceSegmentIds.length
        } segment(s) à faible confiance sont marqués [transcription incertaine].`
      : "Aucune donnée de confiance de transcription disponible.";

  return `${SCORING_PERSONA}

${CRITERIA_DESCRIPTIONS}

CONTEXTE DE LA SESSION
Stimulus visuel : « ${input.stimulus.captionFr} » (thème : ${input.stimulus.theme},
sous-thème : ${input.stimulus.subtopic}). Lien culturel proposé :
${input.stimulus.culturalLinkFr}
Mode : ${input.mode === 'exam' ? 'examen blanc' : 'entraînement'}.
${confidenceNote}

TRANSCRIPTION COMPLÈTE (PART1 = présentation, PART2 = discussion du stimulus,
PART3 = conversation générale) :
${transcriptLines || '(transcription vide)'}

TÂCHE
Évalue cette performance selon les quatre critères ci-dessus. Attribue une note
par critère (A sur 12 ; B1, B2, C sur 6), avec pour chacun : la bande
(Emerging/Developing/Proficient/Strong), une justification en français citant la
transcription, et au moins une citation exacte dans evidenceQuotes. Donne ensuite
3 points forts, 3 priorités d'amélioration et 1 à 5 exercices ciblés. Remplis
uncertaintyNote si les preuves sont insuffisantes ou la transcription peu fiable,
sinon null.`;
}
