import { describe, expect, it } from 'vitest';
import type { ScoreSessionInput } from '../examiner/ExaminerService.js';
import { buildScoringPrompt, scoringResponseJsonSchema, scoringResponseSchema } from './promptBuilder.js';
import { CRITERIA_DESCRIPTIONS } from './rubricDescriptors.js';

const baseInput: ScoreSessionInput = {
  fullTranscript: [
    {
      id: 'seg1',
      phase: 'PART1',
      speaker: 'STUDENT',
      text: "Sur cette image, je vois des lycéens dans une salle de classe.",
      startMs: 0,
      endMs: 4000,
      sttConfidence: 0.9,
    },
    {
      id: 'seg2',
      phase: 'PART2',
      speaker: 'EXAMINER',
      text: 'Pourquoi ce thème est-il important ?',
      startMs: 5000,
      endMs: 7000,
      sttConfidence: null,
    },
  ],
  stimulus: {
    id: 'identites-01',
    theme: 'identites',
    subtopic: 'vie-scolaire',
    captionFr: 'Des lycéens dans une salle de classe en France.',
    culturalLinkFr: 'Le système scolaire français.',
  },
  mode: 'exam',
  sttConfidenceSummary: { avg: 0.9, lowConfidenceSegmentIds: [] },
};

describe('buildScoringPrompt', () => {
  it('includes the transcript labelled by phase and speaker', () => {
    const prompt = buildScoringPrompt(baseInput);
    expect(prompt).toContain('[PART1] ÉTUDIANT');
    expect(prompt).toContain('[PART2] EXAMINATEUR');
    expect(prompt).toContain('des lycéens dans une salle de classe');
  });

  it('marks low-confidence segments so the model can hedge instead of penalising', () => {
    const prompt = buildScoringPrompt({
      ...baseInput,
      sttConfidenceSummary: { avg: 0.4, lowConfidenceSegmentIds: ['seg1'] },
    });
    expect(prompt).toContain('[transcription incertaine]');
    expect(prompt).toContain('1 segment(s) à faible confiance');
  });

  it('states the tool is not affiliated with the IB', () => {
    const prompt = buildScoringPrompt(baseInput);
    expect(prompt).toMatch(/n'es PAS un examinateur officiel/i);
    expect(prompt).toMatch(/jamais\s+une prédiction officielle/i);
  });

  it('does not reproduce distinctive official IB rubric phrasing', () => {
    const denylist = [
      'command of the language',
      'degree of fulfilment',
      'the student demonstrates',
      'clear and effective',
      'a wide range of vocabulary is used',
    ];
    const haystack = (buildScoringPrompt(baseInput) + CRITERIA_DESCRIPTIONS).toLowerCase();
    for (const phrase of denylist) {
      expect(haystack).not.toContain(phrase.toLowerCase());
    }
  });
});

describe('scoring response schema', () => {
  it('requires at least one evidence quote per criterion', () => {
    for (const key of ['criterionA', 'criterionB1', 'criterionB2', 'criterionC'] as const) {
      const schema = scoringResponseJsonSchema.properties[key] as {
        properties: { evidenceQuotes: { minItems: number } };
        required: string[];
      };
      expect(schema.properties.evidenceQuotes.minItems).toBe(1);
      expect(schema.required).toContain('evidenceQuotes');
    }
  });

  it('rejects a response with an empty evidence list', () => {
    const bad = {
      criterionA: { mark: 8, band: 'Proficient', justification: 'x', evidenceQuotes: [] },
      criterionB1: { mark: 4, band: 'Proficient', justification: 'x', evidenceQuotes: ['q'] },
      criterionB2: { mark: 4, band: 'Proficient', justification: 'x', evidenceQuotes: ['q'] },
      criterionC: { mark: 4, band: 'Proficient', justification: 'x', evidenceQuotes: ['q'] },
      strengths: ['a', 'b', 'c'],
      priorities: ['a', 'b', 'c'],
      drills: ['a'],
      uncertaintyNote: null,
    };
    expect(scoringResponseSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects marks above the criterion maximum', () => {
    const bad = {
      criterionA: { mark: 13, band: 'Strong', justification: 'x', evidenceQuotes: ['q'] },
      criterionB1: { mark: 4, band: 'Proficient', justification: 'x', evidenceQuotes: ['q'] },
      criterionB2: { mark: 4, band: 'Proficient', justification: 'x', evidenceQuotes: ['q'] },
      criterionC: { mark: 4, band: 'Proficient', justification: 'x', evidenceQuotes: ['q'] },
      strengths: ['a', 'b', 'c'],
      priorities: ['a', 'b', 'c'],
      drills: ['a'],
      uncertaintyNote: null,
    };
    expect(scoringResponseSchema.safeParse(bad).success).toBe(false);
  });
});
