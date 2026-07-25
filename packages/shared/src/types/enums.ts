export const THEMES = [
  'identites',
  'experiences',
  'ingeniosite',
  'organisation',
  'planete',
] as const;
export type Theme = (typeof THEMES)[number];

/**
 * The IB's own French names for the five prescribed themes.
 *
 * Kept in French because that is what they are officially called and what the
 * examiner works from. The interface is in English — see THEME_LABELS_EN.
 */
export const THEME_LABELS: Record<Theme, string> = {
  identites: 'Identités',
  experiences: 'Expériences',
  ingeniosite: 'Ingéniosité humaine',
  organisation: 'Organisation sociale',
  planete: 'Partage de la planète',
};

/** English theme names, used everywhere in the interface. */
export const THEME_LABELS_EN: Record<Theme, string> = {
  identites: 'Identities',
  experiences: 'Experiences',
  ingeniosite: 'Human Ingenuity',
  organisation: 'Social Organisation',
  planete: 'Sharing the Planet',
};

export const SESSION_MODES = ['exam', 'practice'] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

export const SESSION_STATUSES = [
  'DRAFT',
  'CONSENTED',
  'PREP',
  'PART1_INTRO',
  'PART1_RECORDING',
  'PART1_CLOSING',
  'PART2_QA',
  'PART3_QA',
  'SCORING',
  'COMPLETE',
  'ABANDONED',
  'ERROR',
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const PHASES = ['PART1', 'PART2', 'PART3'] as const;
export type Phase = (typeof PHASES)[number];

export const SPEAKERS = ['STUDENT', 'EXAMINER'] as const;
export type Speaker = (typeof SPEAKERS)[number];

export const CRITERIA = ['A', 'B1', 'B2', 'C'] as const;
export type Criterion = (typeof CRITERIA)[number];

export const CRITERION_MAX: Record<Criterion, number> = {
  A: 12,
  B1: 6,
  B2: 6,
  C: 6,
};

export const MAX_NOTEPAD_BULLETS = 10;
/**
 * Exam timings, in seconds. Single source of truth — the server's phase timers,
 * the prep slider bounds and the on-screen copy all derive from these.
 *
 * Format: 10 minutes preparation, a 10 minute presentation, then 5 minutes of
 * questioning split between the stimulus discussion and the general
 * conversation.
 */
export const PREP_SECONDS_DEFAULT = 600;
export const PART1_SECONDS_CAP = 600;
/** Parts 2 and 3 together make up the 5-minute questioning period. */
export const PART2_SECONDS_CAP = 150;
export const PART3_SECONDS_CAP = 150;

export const QUESTIONING_SECONDS_TOTAL = PART2_SECONDS_CAP + PART3_SECONDS_CAP;
/** Upper bound of the practice-mode preparation slider, in minutes. */
export const PREP_MINUTES_MAX = 15;
