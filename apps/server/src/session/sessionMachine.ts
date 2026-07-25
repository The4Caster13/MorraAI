import type { SessionStatus } from '@parlons/shared';

const TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  DRAFT: ['CONSENTED', 'ABANDONED'],
  CONSENTED: ['PREP', 'ABANDONED'],
  PREP: ['PART1_INTRO', 'ABANDONED', 'ERROR'],
  PART1_INTRO: ['PART1_RECORDING', 'ABANDONED', 'ERROR'],
  PART1_RECORDING: ['PART1_CLOSING', 'ABANDONED', 'ERROR'],
  PART1_CLOSING: ['PART2_QA', 'ABANDONED', 'ERROR'],
  PART2_QA: ['PART3_QA', 'ABANDONED', 'ERROR'],
  PART3_QA: ['SCORING', 'ABANDONED', 'ERROR'],
  SCORING: ['COMPLETE', 'ERROR'],
  COMPLETE: [],
  ABANDONED: [],
  ERROR: [],
};

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: SessionStatus, to: SessionStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: SessionStatus,
    public readonly to: SessionStatus,
  ) {
    super(`Invalid session transition: ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export function phaseForStatus(status: SessionStatus): 'PART1' | 'PART2' | 'PART3' | null {
  switch (status) {
    case 'PART1_INTRO':
    case 'PART1_RECORDING':
    case 'PART1_CLOSING':
      return 'PART1';
    case 'PART2_QA':
      return 'PART2';
    case 'PART3_QA':
      return 'PART3';
    default:
      return null;
  }
}

export function isTerminal(status: SessionStatus): boolean {
  return TRANSITIONS[status].length === 0;
}
