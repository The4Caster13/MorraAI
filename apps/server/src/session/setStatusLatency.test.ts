/**
 * Confirms the fix for felt latency during the exam: a phase transition must
 * notify the client before its DB write resolves, not after. Previously
 * `setStatus` awaited `sessionRepo.update` before emitting, so every button
 * press had a dead pause equal to one database round trip (1-3s+ against a
 * distant region) before the UI changed at all.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

let resolveWrite: (() => void) | null = null;
const updateCalls: Array<Record<string, unknown>> = [];

vi.mock('../db/repositories/index.js', () => ({
  sessionRepo: {
    update: vi.fn((_id: string, data: Record<string, unknown>) => {
      updateCalls.push(data);
      // The DB write hangs until the test explicitly resolves it, simulating
      // a slow remote database — proving the emit does not wait on it.
      return new Promise<void>((resolve) => {
        resolveWrite = resolve;
      });
    }),
  },
  transcriptRepo: { add: vi.fn(async () => ({})), addAudioFile: vi.fn(async () => ({})) },
}));

vi.mock('../storage/StorageService.js', () => ({
  audioPath: (s: string, p: string, sp: string) => `${s}/${p}-${sp}.wav`,
  getStorageService: () => ({
    uploadAudio: vi.fn(async () => {}),
    downloadAudio: vi.fn(async () => Buffer.alloc(0)),
    deleteSessionAudio: vi.fn(async () => {}),
  }),
}));

const { SessionRuntime } = await import('./SessionRuntime.js');
const { MockExaminerService } = await import('../examiner/MockExaminerService.js');

const stimulus = {
  id: 'identites-01',
  theme: 'identites',
  subtopic: 'vie-scolaire',
  captionFr: 'x',
  culturalLinkFr: 'x',
};

beforeEach(() => {
  resolveWrite = null;
  updateCalls.length = 0;
});

describe('setStatus does not block on its DB write', () => {
  it('emits phaseChanged synchronously, before the write resolves', async () => {
    const rt = new SessionRuntime(
      'sess-1',
      'CONSENTED' as never,
      'practice',
      1,
      stimulus,
      new MockExaminerService(),
    );
    const events: string[] = [];
    rt.attach((msg) => events.push(msg.type), false);

    // startPrep triggers exactly one setStatus('PREP') call. Its DB write is
    // mocked to hang forever until resolveWrite() is called — which this test
    // deliberately never does before awaiting. If setStatus still awaited that
    // write internally, this `await` would hang and the test would time out.
    await rt.startPrep();

    expect(events).toContain('server:phaseChanged');
    expect(rt.getStatus()).toBe('PREP');
    // The write was started but is still unresolved — proof the transition
    // above did not wait for it.
    expect(resolveWrite).not.toBeNull();
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]).toMatchObject({ status: 'PREP' });

    resolveWrite!();
    await rt.cleanup();
  });

  it('does not fail the transition if the background write later rejects', async () => {
    vi.mocked(
      (await import('../db/repositories/index.js')).sessionRepo.update,
    ).mockRejectedValueOnce(new Error('connection reset'));
    const rt = new SessionRuntime(
      'sess-1',
      'CONSENTED' as never,
      'practice',
      1,
      stimulus,
      new MockExaminerService(),
    );
    const errors: string[] = [];
    rt.attach((msg) => {
      if (msg.type === 'server:error') errors.push(msg.message);
    }, false);

    await rt.startPrep();
    // Let the rejected background write's .catch() run.
    await new Promise((r) => setTimeout(r, 0));

    expect(rt.getStatus()).toBe('PREP');
    expect(errors).toEqual([]);
    await rt.cleanup();
  });
});
