import { describe, expect, it, vi } from 'vitest';
import type { OpenLiveSessionParams, TranscriptChunk } from './ExaminerService.js';
import { __testing } from './GeminiExaminerService.js';

const { GeminiLiveSession } = __testing;

const stimulus = {
  id: 'identites-01',
  theme: 'identites',
  subtopic: 'vie-scolaire',
  captionFr: 'Des lycéens dans une salle de classe.',
  culturalLinkFr: 'Le lycée français.',
};

/** Stands in for the Gemini SDK session — nothing here should reach the network. */
function fakeSdkSession() {
  return {
    sendRealtimeInput: vi.fn(),
    sendClientContent: vi.fn(),
    close: vi.fn(),
  };
}

function params(overrides: Partial<OpenLiveSessionParams> = {}): OpenLiveSessionParams {
  return {
    phase: 'PART2',
    mode: 'exam',
    stimulus,
    timeRemainingMs: 300_000,
    onStudentTranscript: vi.fn(),
    onExaminerAudio: vi.fn(),
    onExaminerQuestionText: vi.fn(),
    onExaminerInterrupted: vi.fn(),
    onTurnComplete: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
}

function finalCalls(fn: unknown): TranscriptChunk[] {
  return (fn as ReturnType<typeof vi.fn>).mock.calls
    .map((c: unknown[]) => c[0] as TranscriptChunk)
    .filter((c) => c.isFinal);
}

describe('Gemini transcript buffering', () => {
  it('marks a student utterance final so it can be persisted for scoring', () => {
    const p = params();
    const s = new GeminiLiveSession(fakeSdkSession() as never, p);

    s.appendStudentFragment('Sur cette image');
    s.appendStudentFragment(', je vois des lycéens');
    s.flushStudentTurn();

    const finals = finalCalls(p.onStudentTranscript);
    expect(finals).toHaveLength(1);
    expect(finals[0].text).toBe('Sur cette image, je vois des lycéens');
  });

  it('never emits a final chunk while the student is still mid-sentence', () => {
    const p = params();
    const s = new GeminiLiveSession(fakeSdkSession() as never, p);

    s.appendStudentFragment('Je pense que');

    expect(finalCalls(p.onStudentTranscript)).toHaveLength(0);
    expect(p.onStudentTranscript).toHaveBeenCalledWith(
      expect.objectContaining({ isFinal: false, text: 'Je pense que' }),
    );
  });

  it('segments a long Part 1 monologue on sentence boundaries', () => {
    const p = params({ phase: 'PART1' });
    const s = new GeminiLiveSession(fakeSdkSession() as never, p);

    s.appendStudentFragment("Sur cette image, je vois des lycéens dans une salle de classe.");
    s.appendStudentFragment(" Ils travaillent ensemble sur un projet de groupe.");

    const finals = finalCalls(p.onStudentTranscript);
    expect(finals).toHaveLength(2);
    expect(finals[1].text).toBe('Ils travaillent ensemble sur un projet de groupe.');
  });

  it('joins examiner fragments into one question instead of one row per token', () => {
    const p = params();
    const s = new GeminiLiveSession(fakeSdkSession() as never, p);

    s.appendExaminerFragment('Pourquoi ');
    s.appendExaminerFragment('ce thème ');
    s.appendExaminerFragment('vous intéresse-t-il ?');
    s.flushExaminerTurn();

    expect(p.onExaminerQuestionText).toHaveBeenCalledTimes(1);
    expect(p.onExaminerQuestionText).toHaveBeenCalledWith('Pourquoi ce thème vous intéresse-t-il ?');
  });

  it('flushes a part-heard answer on close so it still reaches the scorer', async () => {
    const p = params();
    const s = new GeminiLiveSession(fakeSdkSession() as never, p);

    s.appendStudentFragment('Ma réponse incomplète');
    await s.close();

    expect(finalCalls(p.onStudentTranscript)).toHaveLength(1);
  });

  it('does not emit an empty utterance when nothing was said', () => {
    const p = params();
    const s = new GeminiLiveSession(fakeSdkSession() as never, p);

    s.flushStudentTurn();
    s.flushExaminerTurn();

    expect(finalCalls(p.onStudentTranscript)).toHaveLength(0);
    expect(p.onExaminerQuestionText).not.toHaveBeenCalled();
  });
});
