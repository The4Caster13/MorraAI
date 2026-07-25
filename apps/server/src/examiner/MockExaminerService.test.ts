import { describe, expect, it, vi } from 'vitest';
import { MockExaminerService } from './MockExaminerService.js';
import type { OpenLiveSessionParams } from './ExaminerService.js';

const stimulus = {
  id: 'identites-01',
  theme: 'identites',
  subtopic: 'vie-scolaire',
  captionFr: 'Des lycéens dans une salle de classe.',
  culturalLinkFr: 'Le lycée français.',
};

function params(overrides: Partial<OpenLiveSessionParams> = {}): OpenLiveSessionParams {
  return {
    phase: 'PART2',
    mode: 'practice',
    stimulus,
    timeRemainingMs: 300000,
    onStudentTranscript: vi.fn(),
    onExaminerAudio: vi.fn(),
    onExaminerQuestionText: vi.fn(),
    onExaminerInterrupted: vi.fn(),
    onTurnComplete: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
}

describe('MockExaminerService', () => {
  it('asks an opening question in French for Q&A phases', async () => {
    vi.useFakeTimers();
    const p = params();
    const service = new MockExaminerService();
    await service.openLiveSession(p);
    await vi.advanceTimersByTimeAsync(1000);
    expect(p.onExaminerQuestionText).toHaveBeenCalled();
    expect(p.onExaminerAudio).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('stays silent during Part 1 so the student presents uninterrupted', async () => {
    vi.useFakeTimers();
    const p = params({ phase: 'PART1' });
    const service = new MockExaminerService();
    await service.openLiveSession(p);
    await vi.advanceTimersByTimeAsync(5000);
    expect(p.onExaminerQuestionText).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('rephrases the last question on request', async () => {
    vi.useFakeTimers();
    const p = params();
    const service = new MockExaminerService();
    const live = await service.openLiveSession(p);
    await vi.advanceTimersByTimeAsync(1000);
    const first = (p.onExaminerQuestionText as ReturnType<typeof vi.fn>).mock.calls[0][0];
    live.requestRephrase();
    await vi.advanceTimersByTimeAsync(1000);
    const calls = (p.onExaminerQuestionText as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[calls.length - 1][0]).toContain(first);
    vi.useRealTimers();
  });

  it('produces a score with evidence quotes for every criterion', async () => {
    const service = new MockExaminerService();
    const result = await service.scoreSession({
      fullTranscript: [
        {
          id: 's1',
          phase: 'PART1',
          speaker: 'STUDENT',
          text: 'Je vois une salle de classe.',
          startMs: 0,
          endMs: 1000,
          sttConfidence: 0.9,
        },
      ],
      stimulus,
      mode: 'exam',
      sttConfidenceSummary: { avg: 0.9, lowConfidenceSegmentIds: [] },
      audio: [],
    });
    for (const c of [
      result.criterionA,
      result.criterionB1,
      result.criterionB2,
      result.criterionC,
    ]) {
      expect(c.evidenceQuotes.length).toBeGreaterThan(0);
    }
    expect(result.strengths).toHaveLength(3);
    expect(result.priorities).toHaveLength(3);
    expect(result.uncertaintyNote).toBeTruthy();
  });
});
