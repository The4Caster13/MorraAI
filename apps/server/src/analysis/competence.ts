import type { Criterion } from '@morrai/shared';
import type { LanguageMetrics } from './languageMetrics.js';
import type { SpeechActivity } from './speechActivity.js';

/**
 * Combines delivery and language signals into a running competence estimate.
 *
 * This drives two things: how hard the examiner's next question is, and the
 * fluency description offered to the scorer. It is explicitly *not* a mark —
 * marks come from the model reading the transcript. Think of it as the judgement
 * an examiner makes in the first thirty seconds about how hard to push.
 *
 * Every component is normalised to 0–1 and blended, so no single weak signal
 * (one long pause, one anglicism) can swing the level on its own.
 */

export type Level = 'fragile' | 'intermédiaire' | 'fort';

export interface DeliverySummary {
  wordsPerMinute: number | null;
  speechMs: number;
  pauseCount: number;
  longestPauseMs: number;
  fillerRate: number;
  tenseVariety: number;
  subordinationRate: number;
  lexicalDiversity: number;
}

export interface CompetenceSnapshot {
  estimate: Record<Criterion, number>;
  level: Level;
  delivery: DeliverySummary;
}

/**
 * Comfortable conversational French sits around 130–160 wpm. Learners under
 * exam pressure run slower; below ~70 usually means real hesitation.
 */
const WPM_FLOOR = 60;
const WPM_TARGET = 140;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

export function wordsPerMinute(wordCount: number, speechMs: number): number | null {
  // Too little speech to divide by without producing nonsense.
  if (speechMs < 3000 || wordCount === 0) return null;
  return Math.round((wordCount / (speechMs / 60000)) * 10) / 10;
}

export function estimateCompetence(
  language: LanguageMetrics,
  activity: SpeechActivity,
  utteranceCount: number,
): CompetenceSnapshot {
  const wpm = wordsPerMinute(language.wordCount, activity.speechMs);

  // Fluency: how close the delivery is to a comfortable pace, discounted by
  // hesitation. Unknown pace is treated as mid rather than penalised.
  const paceScore = wpm === null ? 0.5 : clamp01((wpm - WPM_FLOOR) / (WPM_TARGET - WPM_FLOOR));
  const fillerPenalty = clamp01(language.fillerRate / 8);
  const pausePenalty = clamp01(activity.pauses.length / 12);
  const fluency = clamp01(paceScore * 0.6 + (1 - fillerPenalty) * 0.2 + (1 - pausePenalty) * 0.2);

  // Range: grammatical and lexical reach.
  const tenseScore = clamp01(language.tenseVariety / 4);
  const subordinationScore = clamp01(language.subordinationRate / 6);
  const diversityScore = clamp01((language.lexicalDiversity - 0.3) / 0.4);
  const anglicismPenalty = clamp01(language.anglicisms / 6);
  const range = clamp01(
    tenseScore * 0.45 + subordinationScore * 0.3 + diversityScore * 0.25 - anglicismPenalty * 0.2,
  );

  // Criterion A blends command of the language with how fluently it's delivered.
  const a = clamp01(range * 0.6 + fluency * 0.4);

  // Development: sustained, elaborated answers rather than one-liners.
  const volume = clamp01(language.wordCount / 320);
  const development = clamp01(volume * 0.6 + subordinationScore * 0.4);

  // Interaction: sustaining a conversation across turns without prompting.
  const interaction = clamp01((utteranceCount / 8) * 0.6 + fluency * 0.4);

  return {
    estimate: {
      A: round2(a),
      B1: round2(development),
      B2: round2(development),
      C: round2(interaction),
    },
    level: levelFor(a),
    delivery: {
      wordsPerMinute: wpm,
      speechMs: activity.speechMs,
      pauseCount: activity.pauses.length,
      longestPauseMs: activity.longestPauseMs,
      fillerRate: language.fillerRate,
      tenseVariety: language.tenseVariety,
      subordinationRate: language.subordinationRate,
      lexicalDiversity: language.lexicalDiversity,
    },
  };
}

export function levelFor(scoreA: number): Level {
  if (scoreA >= 0.66) return 'fort';
  if (scoreA <= 0.34) return 'fragile';
  return 'intermédiaire';
}

/** Neutral starting point, before the student has said anything. */
export function initialCompetence(): CompetenceSnapshot {
  return {
    estimate: { A: 0.5, B1: 0.5, B2: 0.5, C: 0.5 },
    level: 'intermédiaire',
    delivery: {
      wordsPerMinute: null,
      speechMs: 0,
      pauseCount: 0,
      longestPauseMs: 0,
      fillerRate: 0,
      tenseVariety: 0,
      subordinationRate: 0,
      lexicalDiversity: 0,
    },
  };
}
