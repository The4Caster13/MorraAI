import { describe, expect, it } from 'vitest';
import { analyseLanguage } from './languageMetrics.js';
import { PAUSE_THRESHOLD_MS, rms, SpeechActivityTracker } from './speechActivity.js';
import { estimateCompetence, levelFor, wordsPerMinute } from './competence.js';

/** One chunk of 16 kHz PCM16 at a given amplitude. */
function chunk(ms: number, amplitude: number): Buffer {
  const samples = Math.round((16000 * ms) / 1000);
  const buf = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    // Alternating sign keeps RMS at `amplitude` without DC offset.
    buf.writeInt16LE(Math.round((i % 2 === 0 ? 1 : -1) * amplitude * 0x7fff), i * 2);
  }
  return buf;
}

const speech = (ms: number) => chunk(ms, 0.2);
const silence = (ms: number) => chunk(ms, 0);

describe('rms', () => {
  it('is zero for silence and rises with amplitude', () => {
    expect(rms(silence(100))).toBe(0);
    expect(rms(chunk(100, 0.5))).toBeGreaterThan(rms(chunk(100, 0.1)));
  });

  it('does not divide by zero on an empty buffer', () => {
    expect(rms(Buffer.alloc(0))).toBe(0);
  });
});

describe('SpeechActivityTracker', () => {
  it('measures only the time actually spoken, not wall clock', () => {
    const t = new SpeechActivityTracker();
    t.push(speech(1000));
    t.push(silence(5000));
    t.push(speech(1000));
    const s = t.snapshot();
    expect(s.speechMs).toBe(2000);
    expect(s.silenceMs).toBe(5000);
  });

  it('counts a long gap between speech as a pause', () => {
    const t = new SpeechActivityTracker();
    t.push(speech(500));
    t.push(silence(2000));
    t.push(speech(500));
    expect(t.snapshot().pauses).toHaveLength(1);
    expect(t.snapshot().longestPauseMs).toBe(2000);
  });

  it('ignores gaps shorter than the pause threshold', () => {
    const t = new SpeechActivityTracker();
    t.push(speech(500));
    t.push(silence(PAUSE_THRESHOLD_MS - 100));
    t.push(speech(500));
    expect(t.snapshot().pauses).toHaveLength(0);
  });

  it('does not penalise silence before the student has begun', () => {
    const t = new SpeechActivityTracker();
    t.push(silence(10000));
    t.push(speech(500));
    const s = t.snapshot();
    expect(s.pauses).toHaveLength(0);
    expect(s.silenceMs).toBe(0);
  });

  it('does not count trailing silence as a pause', () => {
    const t = new SpeechActivityTracker();
    t.push(speech(500));
    t.push(silence(5000));
    expect(t.snapshot().pauses).toHaveLength(0);
  });
});

describe('analyseLanguage', () => {
  it('detects a range of tenses', () => {
    const strong = analyseLanguage(
      "J'ai visité Paris l'année dernière. C'était magnifique. Je retournerai bientôt, et si je pouvais, je vivrais là-bas.",
    );
    expect(strong.tenseVariety).toBeGreaterThanOrEqual(3);
  });

  it('counts fillers and reports them per 100 words', () => {
    const m = analyseLanguage('euh je pense euh que bah oui');
    expect(m.fillerRate).toBeGreaterThan(0);
  });

  it('rewards subordination', () => {
    const simple = analyseLanguage('Je vois une image. Il y a des gens. Ils sont contents.');
    const complex = analyseLanguage(
      "Je vois une image qui montre des gens, parce que le photographe voulait montrer ce qui compte, bien que ce soit difficile.",
    );
    expect(complex.subordinationRate).toBeGreaterThan(simple.subordinationRate);
  });

  it('spots anglicisms', () => {
    expect(analyseLanguage('Le weekend je fais du shopping, c est cool').anglicisms).toBeGreaterThan(
      0,
    );
  });

  it('counts an immediately repeated word as a self-correction', () => {
    expect(analyseLanguage('je pense pense que oui').selfCorrections).toBe(1);
  });

  it('returns zeroes rather than NaN for empty input', () => {
    const m = analyseLanguage('');
    expect(m.wordCount).toBe(0);
    expect(m.lexicalDiversity).toBe(0);
    expect(m.fillerRate).toBe(0);
  });
});

describe('wordsPerMinute', () => {
  it('computes against speaking time', () => {
    expect(wordsPerMinute(120, 60000)).toBe(120);
  });

  it('refuses to guess from too little speech', () => {
    expect(wordsPerMinute(5, 1000)).toBeNull();
    expect(wordsPerMinute(0, 60000)).toBeNull();
  });
});

describe('estimateCompetence', () => {
  const activity = (speechMs: number, pauses: number[]) => ({
    speechMs,
    silenceMs: 0,
    pauses,
    longestPauseMs: pauses.length ? Math.max(...pauses) : 0,
  });

  it('rates a fluent, varied speaker above a hesitant simple one', () => {
    const strong = estimateCompetence(
      analyseLanguage(
        "J'ai visité Paris parce que je voulais découvrir la culture française, bien que ce soit cher. " +
          'Si je pouvais y retourner, je passerais plus de temps dans les musées qui racontent son histoire. ' +
          "Cette expérience m'a transformé et je retournerai certainement.",
      ),
      activity(30000, []),
      8,
    );
    const weak = estimateCompetence(
      analyseLanguage('euh je vois euh des gens. euh ils sont euh contents. bah oui.'),
      activity(30000, [2000, 3000, 2500, 4000, 2000, 3000]),
      2,
    );
    expect(strong.estimate.A).toBeGreaterThan(weak.estimate.A);
    expect(strong.estimate.C).toBeGreaterThan(weak.estimate.C);
  });

  it('keeps every score inside 0–1', () => {
    for (const text of ['', 'euh '.repeat(200), 'mot '.repeat(2000)]) {
      const s = estimateCompetence(analyseLanguage(text), activity(60000, []), 20);
      for (const value of Object.values(s.estimate)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('starts neutral when nothing has been said', () => {
    const s = estimateCompetence(analyseLanguage(''), activity(0, []), 0);
    expect(s.level).toBe('fragile');
    expect(s.delivery.wordsPerMinute).toBeNull();
  });
});

describe('levelFor', () => {
  it('splits into three bands', () => {
    expect(levelFor(0.1)).toBe('fragile');
    expect(levelFor(0.5)).toBe('intermédiaire');
    expect(levelFor(0.9)).toBe('fort');
  });
});
