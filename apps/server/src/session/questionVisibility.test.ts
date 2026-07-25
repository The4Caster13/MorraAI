import { describe, expect, it } from 'vitest';

/**
 * The rule that decides whether the examiner's question reaches the student as
 * text. Kept as a named predicate so the mock-examiner case is pinned down:
 * a silent examiner whose text is also hidden is simply not there.
 */
function shouldSendQuestionText(
  showText: boolean,
  speaksAloud: boolean,
  audioHasArrived = true,
): boolean {
  return showText || !speaksAloud || !audioHasArrived;
}

describe('examiner question visibility', () => {
  it('always shows text for a silent examiner, toggle off', () => {
    // The reported bug: mock mode emits silence, so with the toggle off the
    // student saw and heard nothing after answering.
    expect(shouldSendQuestionText(false, false)).toBe(true);
  });

  it('hides text for a speaking examiner with the toggle off', () => {
    // Exam realism: listen, don't read.
    expect(shouldSendQuestionText(false, true)).toBe(false);
  });

  it('shows text for a speaking examiner when the student opts in', () => {
    expect(shouldSendQuestionText(true, true)).toBe(true);
  });

  it('shows text for a silent examiner with the toggle on', () => {
    expect(shouldSendQuestionText(true, false)).toBe(true);
  });

  it('falls back to text when a speaking examiner has sent no audio yet', () => {
    // A Live model that transcribes but never synthesises would otherwise leave
    // the student with a blank screen and no sound.
    expect(shouldSendQuestionText(false, true, false)).toBe(true);
  });

  it('returns to hiding text once audio actually arrives', () => {
    expect(shouldSendQuestionText(false, true, true)).toBe(false);
  });
});
