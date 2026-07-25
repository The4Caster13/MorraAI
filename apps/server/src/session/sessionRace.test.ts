/**
 * Regression tests for concurrent phase-end events.
 *
 * Transitions span several awaited DB writes. Against a slow database that
 * window is seconds wide, so a double-click — or the phase timer firing while
 * the student ends the phase manually — used to interleave two transitions and
 * throw "Invalid session transition: ABANDONED -> PART2_QA".
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const updates: Array<Record<string, unknown>> = [];

// Every DB write is delayed to widen the interleaving window on purpose.
const SLOW_MS = 20;

vi.mock('../db/repositories/index.js', () => ({
  sessionRepo: {
    update: vi.fn(async (_id: string, data: Record<string, unknown>) => {
      await new Promise((r) => setTimeout(r, SLOW_MS));
      updates.push(data);
      return {};
    }),
  },
  transcriptRepo: {
    add: vi.fn(async () => ({})),
    addAudioFile: vi.fn(async () => ({})),
  },
}));

vi.mock('../storage/StorageService.js', () => ({
  audioPath: (s: string, p: string, sp: string) => `${s}/${p}-${sp}.wav`,
  getStorageService: () => ({
    uploadAudio: vi.fn(async () => {}),
    downloadAudio: vi.fn(async () => Buffer.alloc(0)),
    deleteSessionAudio: vi.fn(async () => {}),
  }),
}));

vi.mock('../scoring/scoreSession.js', () => ({
  scoreAndPersist: vi.fn(async () => {
    await new Promise((r) => setTimeout(r, SLOW_MS));
    return {};
  }),
}));

const { SessionRuntime } = await import('./SessionRuntime.js');
const { MockExaminerService } = await import('../examiner/MockExaminerService.js');

const stimulus = {
  id: 'identites-01',
  theme: 'identites',
  subtopic: 'vie-scolaire',
  captionFr: 'Des lycéens dans une salle de classe.',
  culturalLinkFr: 'Le lycée français.',
};

function makeRuntime(status: 'CONSENTED' | 'PART1_RECORDING' | 'PART3_QA' = 'CONSENTED') {
  const rt = new SessionRuntime(
    'sess-1',
    status as never,
    'practice',
    1,
    stimulus,
    new MockExaminerService(),
  );
  const errors: string[] = [];
  rt.attach((msg) => {
    if (msg.type === 'server:error') errors.push(msg.message);
  }, false);
  return { rt, errors };
}

/** Drives the session to PART1_RECORDING without waiting on the prep timer. */
async function toPart1Recording() {
  const { rt, errors } = makeRuntime();
  await rt.startPrep();
  await rt.skipPrep();
  expect(rt.getStatus()).toBe('PART1_RECORDING');
  return { rt, errors };
}

beforeEach(() => {
  updates.length = 0;
});

describe('finishing the presentation', () => {
  it('advances to Part 2 rather than abandoning', async () => {
    const { rt } = await toPart1Recording();
    await rt.finishPresentation();
    expect(rt.getStatus()).toBe('PART2_QA');
    expect(updates.map((u) => u.status)).not.toContain('ABANDONED');
    await rt.cleanup();
  });

  it('survives a double-press without abandoning the next phase', async () => {
    const { rt } = await toPart1Recording();

    // Both fire before the first transition's DB writes finish — this is the
    // exact interleaving that produced "ABANDONED -> PART2_QA".
    await Promise.all([rt.finishPresentation(), rt.finishPresentation()]);

    expect(rt.getStatus()).toBe('PART2_QA');
    await rt.cleanup();
  });

  it('survives three rapid presses', async () => {
    const { rt } = await toPart1Recording();
    await Promise.all([
      rt.finishPresentation(),
      rt.finishPresentation(),
      rt.finishPresentation(),
    ]);
    expect(rt.getStatus()).toBe('PART2_QA');
    await rt.cleanup();
  });

  it('never surfaces an invalid transition to the client', async () => {
    const { rt, errors } = await toPart1Recording();
    await Promise.all([rt.finishPresentation(), rt.finishPresentation()]);
    expect(errors.filter((e) => /Invalid session transition/.test(e))).toEqual([]);
    await rt.cleanup();
  });

  it('is ignored outside Part 1', async () => {
    const { rt } = await toPart1Recording();
    await rt.finishPresentation();
    expect(rt.getStatus()).toBe('PART2_QA');
    await rt.finishPresentation();
    expect(rt.getStatus()).toBe('PART2_QA');
    await rt.cleanup();
  });
});

describe('mixed concurrent events', () => {
  it('finishing and abandoning at the same instant reaches one coherent state', async () => {
    const { rt, errors } = await toPart1Recording();

    await Promise.all([rt.finishPresentation(), rt.requestEnd()]);

    // Either order is defensible; landing mid-transition or throwing is not.
    expect(['PART2_QA', 'ABANDONED']).toContain(rt.getStatus());
    expect(errors.filter((e) => /Invalid session transition/.test(e))).toEqual([]);
    await rt.cleanup();
  });

  it('abandoning then finishing does not resurrect an ended session', async () => {
    const { rt, errors } = await toPart1Recording();

    await rt.requestEnd();
    expect(rt.getStatus()).toBe('ABANDONED');

    // A late press from a client that had not yet seen the phase change.
    await rt.finishPresentation();

    expect(rt.getStatus()).toBe('ABANDONED');
    expect(errors.filter((e) => /Invalid session transition/.test(e))).toEqual([]);
    await rt.cleanup();
  });

  it('interleaves many mixed events without an invalid transition', async () => {
    const { rt, errors } = await toPart1Recording();

    await Promise.all([
      rt.finishPresentation(),
      rt.requestEnd(),
      rt.finishPresentation(),
      rt.requestEnd(),
      rt.finishPresentation(),
    ]);

    expect(errors.filter((e) => /Invalid session transition/.test(e))).toEqual([]);
    await rt.cleanup();
  });
});

describe('deliberately ending the session', () => {
  it('abandons when ended during prep', async () => {
    const { rt } = makeRuntime();
    await rt.startPrep();
    expect(rt.getStatus()).toBe('PREP');
    await rt.requestEnd();
    expect(rt.getStatus()).toBe('ABANDONED');
    await rt.cleanup();
  });

  it('ignores repeat requests once terminal', async () => {
    const { rt, errors } = makeRuntime();
    await rt.startPrep();
    await Promise.all([rt.requestEnd(), rt.requestEnd(), rt.requestEnd()]);
    expect(rt.getStatus()).toBe('ABANDONED');
    expect(errors).toEqual([]);
    await rt.cleanup();
  });

  it('scores instead of abandoning when Part 3 is ended', async () => {
    // Part 3 is only reached after ~10 minutes of timers, so start there.
    const { rt } = makeRuntime('PART3_QA');
    await rt.requestEnd();
    expect(rt.getStatus()).toBe('COMPLETE');
    await rt.cleanup();
  });

  it('does not double-score when Part 3 end is pressed twice', async () => {
    const { rt, errors } = makeRuntime('PART3_QA');
    await Promise.all([rt.requestEnd(), rt.requestEnd()]);
    expect(rt.getStatus()).toBe('COMPLETE');
    expect(updates.filter((u) => u.status === 'SCORING')).toHaveLength(1);
    expect(errors).toEqual([]);
    await rt.cleanup();
  });
});
