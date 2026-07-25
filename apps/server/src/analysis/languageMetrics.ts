/**
 * Language-quality signals extracted from the student's transcript.
 *
 * These describe *how* the French is constructed rather than what it says:
 * range of tenses, use of subordination, lexical variety, and the hesitation
 * markers that pad speech under pressure. Together with the delivery metrics
 * they replace the previous heuristic — average utterance length plus five
 * regexes — that decided how hard the examiner's questions should be.
 *
 * Everything here is approximate. French morphology is far richer than these
 * patterns capture, and no attempt is made at real parsing: the aim is a stable
 * relative signal across a single student's session, not linguistic truth.
 */

/** Hesitation markers and discourse padding common in learner French. */
const FILLERS = [
  /\beuh+\b/gi,
  /\beuhm+\b/gi,
  /\bhein\b/gi,
  /\bbah\b/gi,
  /\bben\b/gi,
  /\bdonc voilà\b/gi,
  /\bje sais pas\b/gi,
  /\bcomment dire\b/gi,
  /\bc'est-à-dire\b/gi,
];

/** Rough tense detectors — presence matters, not precision. */
const TENSE_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'passé composé', re: /\b(j'ai|tu as|il a|elle a|nous avons|vous avez|ils ont|on a)\s+\w+(é|i|u|is|it)\b/i },
  { name: 'imparfait', re: /\b\w+(ais|ait|aient|ions|iez)\b/i },
  { name: 'futur', re: /\b\w+(rai|ras|ra|rons|rez|ront)\b/i },
  { name: 'conditionnel', re: /\b\w+(rais|rait|rions|riez|raient)\b/i },
  { name: 'subjonctif', re: /\b(que|qu')\s+\w+\s+\w+(e|es|ions|iez|ent)\b/i },
  { name: 'présent', re: /\b(je|tu|il|elle|on|nous|vous|ils|elles)\s+\w+(e|es|ons|ez|ent|is|it)\b/i },
];

/** Markers of complex sentence construction. */
const SUBORDINATION = [
  /\bparce que\b/gi,
  /\bbien que\b/gi,
  /\balors que\b/gi,
  /\btandis que\b/gi,
  /\bpuisque\b/gi,
  /\bafin que\b/gi,
  /\bpour que\b/gi,
  /\bmême si\b/gi,
  /\bqui\b/gi,
  /\bdont\b/gi,
  /\blorsque\b/gi,
  /\bce qui\b/gi,
  /\bce que\b/gi,
];

/** Words borrowed straight from English, a common Criterion A deduction. */
const ANGLICISMS = [
  /\bshopping\b/gi,
  /\bweek-?end\b/gi,
  /\bcool\b/gi,
  /\bnice\b/gi,
  /\bactually\b/gi,
  /\bso\b\s/gi,
  /\bbecause\b/gi,
  /\bpeople\b/gi,
  /\bthing\b/gi,
];

export interface LanguageMetrics {
  wordCount: number;
  /** Distinct tenses detected, 0–6. */
  tenseVariety: number;
  tensesUsed: string[];
  /** Subordinating constructions per 100 words. */
  subordinationRate: number;
  /** Filler occurrences per 100 words. */
  fillerRate: number;
  /** Distinct words ÷ total words. Falls naturally as length grows. */
  lexicalDiversity: number;
  anglicisms: number;
  /** Immediate word repetitions, a proxy for self-correction. */
  selfCorrections: number;
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((total, re) => total + (text.match(re)?.length ?? 0), 0);
}

export function analyseLanguage(text: string): LanguageMetrics {
  const words = text.toLowerCase().match(/[\p{L}'-]+/gu) ?? [];
  const wordCount = words.length;
  const per100 = (n: number) => (wordCount === 0 ? 0 : round2((n / wordCount) * 100));

  const tensesUsed = TENSE_PATTERNS.filter((t) => t.re.test(text)).map((t) => t.name);

  let selfCorrections = 0;
  for (let i = 1; i < words.length; i++) {
    if (words[i] === words[i - 1] && words[i].length > 2) selfCorrections += 1;
  }

  return {
    wordCount,
    tenseVariety: tensesUsed.length,
    tensesUsed,
    subordinationRate: per100(countMatches(text, SUBORDINATION)),
    fillerRate: per100(countMatches(text, FILLERS)),
    lexicalDiversity: wordCount === 0 ? 0 : round2(new Set(words).size / wordCount),
    anglicisms: countMatches(text, ANGLICISMS),
    selfCorrections,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
