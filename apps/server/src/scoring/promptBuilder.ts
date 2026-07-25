import { z } from 'zod';
import { PHASES } from '@parlons/shared';
import type { ScoreSessionInput } from '../examiner/ExaminerService.js';
import { CRITERIA_DESCRIPTIONS, SCORING_PERSONA } from './rubricDescriptors.js';

const criterionResultSchema = z.object({
  mark: z.number().int().min(0),
  band: z.enum(['Emerging', 'Developing', 'Proficient', 'Strong']),
  justification: z.string().min(1),
  evidenceQuotes: z.array(z.string()).min(1),
});

const deliverySchema = z.object({
  audioAssessed: z.boolean(),
  pronunciation: z.string().min(1),
  intonation: z.string().min(1),
  fluency: z.string().min(1),
  pace: z.string().min(1),
  observations: z.array(z.string()),
});

export const scoringResponseSchema = z.object({
  transcribedTurns: z.array(z.object({ phase: z.enum(PHASES), text: z.string() })),
  delivery: deliverySchema,
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
    transcribedTurns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          phase: { type: 'string', enum: [...PHASES] },
          text: { type: 'string' },
        },
        required: ['phase', 'text'],
      },
    },
    delivery: {
      type: 'object',
      properties: {
        audioAssessed: { type: 'boolean' },
        pronunciation: { type: 'string' },
        intonation: { type: 'string' },
        fluency: { type: 'string' },
        pace: { type: 'string' },
        observations: { type: 'array', items: { type: 'string' } },
      },
      required: ['audioAssessed', 'pronunciation', 'intonation', 'fluency', 'pace', 'observations'],
    },
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
    'transcribedTurns',
    'delivery',
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

const PHASE_LABELS: Record<string, string> = {
  PART1: 'Partie 1 — présentation du stimulus',
  PART2: 'Partie 2 — discussion du stimulus',
  PART3: 'Partie 3 — conversation générale',
};

export function buildScoringPrompt(input: ScoreSessionInput): string {
  const transcriptLines = input.fullTranscript
    .map((seg) => {
      const who = seg.speaker === 'STUDENT' ? 'ÉTUDIANT' : 'EXAMINATEUR';
      const lowConf = input.sttConfidenceSummary.lowConfidenceSegmentIds.includes(seg.id)
        ? ' [transcription incertaine]'
        : '';
      return `[${seg.phase}] ${who}${lowConf} : ${seg.text}`;
    })
    .join('\n');

  const hasAudio = input.audio.length > 0;
  const audioManifest = hasAudio
    ? input.audio
        .map(
          (a, i) =>
            `  ${i + 1}. ${PHASE_LABELS[a.phase] ?? a.phase} — ${Math.round(a.durationMs / 1000)} s`,
        )
        .join('\n')
    : '  (aucun enregistrement disponible)';

  const audioInstructions = hasAudio
    ? `ENREGISTREMENTS FOURNIS (voix de l'étudiant uniquement, dans cet ordre) :
${audioManifest}

Écoute chaque enregistrement en entier avant de noter.

1. TRANSCRIPTION — transcris fidèlement ce que dit l'étudiant, enregistrement par
   enregistrement, dans transcribedTurns (une entrée par prise de parole, avec
   la partie correspondante). Transcris ce que tu entends réellement, y compris
   les hésitations importantes ; ne corrige pas ses erreurs de langue.
2. DÉBIT ET PRONONCIATION — remplis delivery à partir de ce que tu ENTENDS :
   - pronunciation : sons français difficiles (r, u/ou, nasales, liaisons,
     e muet), accent, mots précis mal prononcés ;
   - intonation : mélodie des phrases, intonation montante des questions,
     expressivité ou monotonie ;
   - fluency : hésitations, « euh », faux départs, autocorrections, pauses
     longues, aisance générale ;
   - pace : débit trop rapide, trop lent, ou adapté ;
   - observations : moments précis entendus (cite le mot ou la phrase).
   Mets audioAssessed à true.
3. Le CRITÈRE A doit s'appuyer à la fois sur la langue (vocabulaire, grammaire,
   structures) ET sur ce que tu as entendu (prononciation, intonation, aisance).
   Sa justification doit mentionner explicitement les deux.`
    : `AUCUN ENREGISTREMENT N'EST DISPONIBLE pour cette session.

- Mets delivery.audioAssessed à false et indique dans chaque champ de delivery
  qu'aucun enregistrement n'a pu être analysé. N'invente jamais d'observation
  sur la prononciation ou l'intonation.
- Note le critère A uniquement sur la langue visible dans la transcription, et
  précise dans sa justification que la prononciation et l'intonation n'ont pas
  pu être évaluées.
- Signale cette limite dans uncertaintyNote.
- Laisse transcribedTurns vide.`;

  const confidenceNote =
    input.sttConfidenceSummary.avg !== null
      ? `Confiance moyenne de la transcription automatique : ${Math.round(
          input.sttConfidenceSummary.avg * 100,
        )}%. ${input.sttConfidenceSummary.lowConfidenceSegmentIds.length} segment(s) à faible confiance sont marqués [transcription incertaine].`
      : "Aucune donnée de confiance pour la transcription automatique.";

  const transcriptBlock = transcriptLines
    ? `TRANSCRIPTION AUTOMATIQUE (peut être incomplète ou erronée — l'audio fait foi) :
${transcriptLines}`
    : `TRANSCRIPTION AUTOMATIQUE : vide. ${
        hasAudio
          ? "Reconstitue la conversation à partir de l'audio."
          : 'Aucune preuve disponible.'
      }`;

  return `${SCORING_PERSONA}

${CRITERIA_DESCRIPTIONS}

CONTEXTE DE LA SESSION
Stimulus visuel : « ${input.stimulus.captionFr} » (thème : ${input.stimulus.theme},
sous-thème : ${input.stimulus.subtopic}).
Lien culturel proposé : ${input.stimulus.culturalLinkFr}
Mode : ${input.mode === 'exam' ? 'examen blanc' : 'entraînement'}.
${confidenceNote}

${audioInstructions}

${transcriptBlock}

TÂCHE
Évalue cette performance selon les quatre critères. Attribue une note par critère
(A sur 12 ; B1, B2, C sur 6), avec pour chacun la bande
(Emerging/Developing/Proficient/Strong), une justification en français et au
moins une citation exacte dans evidenceQuotes. Donne ensuite 3 points forts,
3 priorités et 1 à 5 exercices ciblés. Remplis uncertaintyNote si les preuves
sont insuffisantes, sinon null.`;
}
