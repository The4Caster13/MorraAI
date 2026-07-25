export const THEMES = [
  'identites',
  'experiences',
  'ingeniosite',
  'organisation',
  'planete',
] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  identites: 'Identités',
  experiences: 'Expériences',
  ingeniosite: 'Ingéniosité humaine',
  organisation: 'Organisation sociale',
  planete: 'Partage de la planète',
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
export const PREP_SECONDS_DEFAULT = 900;
export const PART1_SECONDS_CAP = 240;
export const PART2_SECONDS_CAP = 300;
export const PART3_SECONDS_CAP = 360;
