import { describe, expect, it } from 'vitest';

/**
 * The rule that decides whether the examiner's question reaches the student as
 * text. Kept as a named predicate so the mock-examiner case is pinned down:
 * a silent examiner whose text is also hidden is simply not there.
 */
function shouldSendQuestionText(showText: boolean, speaksAloud: boolean): boolean {
  return showText || !speaksAloud;
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
});
