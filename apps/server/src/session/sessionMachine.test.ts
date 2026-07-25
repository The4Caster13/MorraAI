import { describe, expect, it } from 'vitest';

describe('ending early still produces a report', () => {
  it('allows scoring straight from Part 2', async () => {
    const { canTransition } = await import('./sessionMachine.js');
    // Previously PART2_QA could only be abandoned, throwing the attempt away.
    expect(canTransition('PART2_QA', 'SCORING')).toBe(true);
    expect(canTransition('PART3_QA', 'SCORING')).toBe(true);
  });

  it('still refuses to score before the student has spoken', async () => {
    const { canTransition } = await import('./sessionMachine.js');
    expect(canTransition('PREP', 'SCORING')).toBe(false);
    expect(canTransition('CONSENTED', 'SCORING')).toBe(false);
  });
});
import { canTransition, isTerminal, phaseForStatus } from './sessionMachine.js';

describe('sessionMachine', () => {
  it('walks the full happy path', () => {
    const path = [
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
    ] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it('rejects phase skipping', () => {
    expect(canTransition('DRAFT', 'PREP')).toBe(false);
    expect(canTransition('CONSENTED', 'PART1_RECORDING')).toBe(false);
    expect(canTransition('PREP', 'PART2_QA')).toBe(false);
    expect(canTransition('PART1_RECORDING', 'PART3_QA')).toBe(false);
  });

  it('cannot leave terminal states', () => {
    for (const terminal of ['COMPLETE', 'ABANDONED', 'ERROR'] as const) {
      expect(isTerminal(terminal)).toBe(true);
      expect(canTransition(terminal, 'PREP')).toBe(false);
    }
  });

  it('cannot score without consent', () => {
    expect(canTransition('DRAFT', 'SCORING')).toBe(false);
  });

  it('maps statuses to phases', () => {
    expect(phaseForStatus('PART1_RECORDING')).toBe('PART1');
    expect(phaseForStatus('PART2_QA')).toBe('PART2');
    expect(phaseForStatus('PART3_QA')).toBe('PART3');
    expect(phaseForStatus('PREP')).toBeNull();
    expect(phaseForStatus('COMPLETE')).toBeNull();
  });
});
