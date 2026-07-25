import type { Criterion } from '../types/enums.js';

// Original paraphrased band labels — intentionally NOT the official IB wording.
export const BAND_LABELS = ['Emerging', 'Developing', 'Proficient', 'Strong'] as const;
export type BandLabel = (typeof BAND_LABELS)[number];

export const BAND_RANGES: Record<Criterion, Record<BandLabel, [number, number]>> = {
  A: { Emerging: [0, 3], Developing: [4, 6], Proficient: [7, 9], Strong: [10, 12] },
  B1: { Emerging: [0, 1], Developing: [2, 3], Proficient: [4, 5], Strong: [6, 6] },
  B2: { Emerging: [0, 1], Developing: [2, 3], Proficient: [4, 5], Strong: [6, 6] },
  C: { Emerging: [0, 1], Developing: [2, 3], Proficient: [4, 5], Strong: [6, 6] },
};

export function bandForMark(criterion: Criterion, mark: number): BandLabel {
  const ranges = BAND_RANGES[criterion];
  for (const label of BAND_LABELS) {
    const [lo, hi] = ranges[label];
    if (mark >= lo && mark <= hi) return label;
  }
  return 'Emerging';
}

export const DISCLAIMER_FR =
  "Ceci est une estimation d'entraînement générée par une IA. Morrai n'est ni affilié ni approuvé par l'IB. Ces notes ne sont pas une prédiction officielle de résultat.";

export const DISCLAIMER_EN =
  'This is an AI-generated practice estimate. Morrai is not affiliated with or endorsed by the IB. These marks are not an official predicted grade.';
