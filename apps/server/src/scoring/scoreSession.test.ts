/**
 * Verifies that the stored recordings actually reach the scorer.
 *
 * Criterion A covers pronunciation, intonation and fluency, so scoring from the
 * transcript alone silently marks a third of that criterion on no evidence.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScoreSessionInput, ScoreSessionResult } from '../examiner/ExaminerService.js';

const audioFiles = new Map<string, { filePath: string; durationMs: number }>();
const stored = new Map<string, Buffer>();
const addedSegments: Array<Record<string, unknown>> = [];
let existingSegments: Array<Record<string, unknown>> = [];
let created: Record<string, unknown> | null = null;

vi.mock('../db/repositories/index.js', () => ({
  transcriptRepo: {
    listBySession: vi.fn(async () => existingSegments),
    findAudioFile: vi.fn(async (_s: string, phase: string, speaker: string) =>
      audioFiles.get(`${phase}-${speaker}`) ?? null,
    ),
    add: vi.fn(async (data: Record<string, unknown>) => {
      addedSegments.push(data);
      return data;
    }),
  },
  scoreRepo: {
    create: vi.fn(async (data: Record<string, unknown>) => {
      created = data;
      return data;
    }),
  },
}));

vi.mock('../storage/StorageService.js', () => ({
  audioPath: (s: string, p: string, sp: string) => `${s}/${p}-${sp}.wav`,
  getStorageService: () => ({
    uploadAudio: vi.fn(async () => {}),
    downloadAudio: vi.fn(async (path: string) => {
      const buf = stored.get(path);
      if (!buf) throw new Error(`no such object ${path}`);
      return buf;
    }),
    deleteSessionAudio: vi.fn(async () => {}),
  }),
}));

const { scoreAndPersist } = await import('./scoreSession.js');

const stimulus = {
  id: 'identites-01',
  theme: 'identites',
  subtopic: 'vie-scolaire',
  captionFr: 'Des lycéens dans une salle de classe.',
  culturalLinkFr: 'Le lycée français.',
};

function fakeResult(over: Partial<ScoreSessionResult> = {}): ScoreSessionResult {
  const c = { mark: 4, band: 'Proficient', justification: 'j', evidenceQuotes: ['q'] };
  return {
    criterionA: { ...c, mark: 8 },
    criterionB1: c,
    criterionB2: c,
    criterionC: c,
    delivery: {
      audioAssessed: true,
      pronunciation: 'r guttural bien articulé',
      intonation: 'montante sur les questions',
      fluency: 'quelques « euh »',
      pace: 'adapté',
      observations: ['« ingéniosité » hésitant'],
    },
    transcribedTurns: [],
    strengths: ['a', 'b', 'c'],
    priorities: ['a', 'b', 'c'],
    drills: ['d'],
    uncertaintyNote: null,
    ...over,
  };
}

/** Captures what the examiner was handed so the audio wiring can be asserted. */
function spyExaminer(result: ScoreSessionResult = fakeResult()) {
  const seen: ScoreSessionInput[] = [];
  return {
    seen,
    service: {
      openLiveSession: vi.fn(),
      scoreSession: vi.fn(async (input: ScoreSessionInput) => {
        seen.push(input);
        return result;
      }),
    },
  };
}

beforeEach(() => {
  audioFiles.clear();
  stored.clear();
  addedSegments.length = 0;
  existingSegments = [];
  created = null;
});

function giveAudio(phase: string, bytes: number) {
  const path = `sess-1/${phase}-STUDENT.wav`;
  audioFiles.set(`${phase}-STUDENT`, { filePath: path, durationMs: 60_000 });
  stored.set(path, Buffer.alloc(bytes, 1));
}

describe('audio reaches the scorer', () => {
  it('passes every stored phase recording, oldest first', async () => {
    giveAudio('PART1', 32);
    giveAudio('PART2', 64);
    giveAudio('PART3', 16);
    const { seen, service } = spyExaminer();

    await scoreAndPersist('sess-1', stimulus, 'exam', service as never, {
      lowConfidenceSegments: 0,
    });

    expect(seen[0].audio.map((a) => a.phase)).toEqual(['PART1', 'PART2', 'PART3']);
    expect(seen[0].audio.map((a) => a.wav.length)).toEqual([32, 64, 16]);
  });

  it('passes no audio when nothing was recorded', async () => {
    const { seen, service } = spyExaminer();
    await scoreAndPersist('sess-1', stimulus, 'exam', service as never, {
      lowConfidenceSegments: 0,
    });
    expect(seen[0].audio).toEqual([]);
  });

  it('skips a clip that cannot be downloaded rather than failing the report', async () => {
    giveAudio('PART1', 32);
    // Recorded in the DB but missing from storage.
    audioFiles.set('PART2-STUDENT', { filePath: 'sess-1/PART2-STUDENT.wav', durationMs: 1000 });
    const { seen, service } = spyExaminer();

    await scoreAndPersist('sess-1', stimulus, 'exam', service as never, {
      lowConfidenceSegments: 0,
    });

    expect(seen[0].audio.map((a) => a.phase)).toEqual(['PART1']);
    expect(created).not.toBeNull();
  });

  it('ignores an empty recording', async () => {
    giveAudio('PART1', 0);
    const { seen, service } = spyExaminer();
    await scoreAndPersist('sess-1', stimulus, 'exam', service as never, {
      lowConfidenceSegments: 0,
    });
    expect(seen[0].audio).toEqual([]);
  });
});

describe('delivery assessment is persisted', () => {
  it('stores every delivery dimension with the score', async () => {
    giveAudio('PART1', 32);
    const { service } = spyExaminer();

    await scoreAndPersist('sess-1', stimulus, 'exam', service as never, {
      lowConfidenceSegments: 0,
    });

    const rationale = created!.rationaleJson as Record<string, Record<string, unknown>>;
    expect(rationale.delivery.audioAssessed).toBe(true);
    expect(rationale.delivery.pronunciation).toContain('r guttural');
    expect(rationale.delivery.intonation).toBeTruthy();
    expect(rationale.delivery.fluency).toBeTruthy();
    expect(rationale.delivery.pace).toBeTruthy();
    expect(rationale.delivery.observations).toHaveLength(1);
  });

  it('recomputes the total rather than trusting the model', async () => {
    const { service } = spyExaminer();
    await scoreAndPersist('sess-1', stimulus, 'exam', service as never, {
      lowConfidenceSegments: 0,
    });
    // 8 + 4 + 4 + 4
    expect(created!.total).toBe(20);
  });
});

describe('transcript recovery from audio', () => {
  it('saves what the scorer heard when live transcription produced nothing', async () => {
    giveAudio('PART1', 32);
    const { service } = spyExaminer(
      fakeResult({
        transcribedTurns: [
          { phase: 'PART1', text: 'Sur cette image je vois une salle de classe.' },
          { phase: 'PART2', text: 'Je pense que ce thème est important.' },
        ],
      }),
    );

    await scoreAndPersist('sess-1', stimulus, 'exam', service as never, {
      lowConfidenceSegments: 0,
    });

    expect(addedSegments).toHaveLength(2);
    expect(addedSegments[0]).toMatchObject({ phase: 'PART1', speaker: 'STUDENT' });
    expect(addedSegments[0].text).toContain('salle de classe');
  });

  it('does not overwrite a transcript that live speech-to-text already produced', async () => {
    existingSegments = [
      {
        id: 's1',
        phase: 'PART1',
        speaker: 'STUDENT',
        text: 'Déjà transcrit en direct.',
        startMs: 0,
        endMs: 1,
        sttConfidence: 0.9,
      },
    ];
    giveAudio('PART1', 32);
    const { service } = spyExaminer(
      fakeResult({ transcribedTurns: [{ phase: 'PART1', text: 'version audio' }] }),
    );

    await scoreAndPersist('sess-1', stimulus, 'exam', service as never, {
      lowConfidenceSegments: 0,
    });

    expect(addedSegments).toEqual([]);
  });

  it('skips blank transcribed turns', async () => {
    giveAudio('PART1', 32);
    const { service } = spyExaminer(
      fakeResult({
        transcribedTurns: [
          { phase: 'PART1', text: '   ' },
          { phase: 'PART1', text: 'du contenu réel' },
        ],
      }),
    );

    await scoreAndPersist('sess-1', stimulus, 'exam', service as never, {
      lowConfidenceSegments: 0,
    });

    expect(addedSegments).toHaveLength(1);
    expect(addedSegments[0].text).toBe('du contenu réel');
  });
});
