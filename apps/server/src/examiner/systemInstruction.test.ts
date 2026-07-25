import { describe, expect, it } from 'vitest';
import type { DeliveryContext, OpenLiveSessionParams } from './ExaminerService.js';
import { systemInstruction } from './GeminiExaminerService.js';

const stimulus = {
  id: 'identites-01',
  theme: 'identites',
  subtopic: 'vie-scolaire',
  captionFr: 'Des lycéens dans une salle de classe.',
  culturalLinkFr: 'Le lycée français.',
};

function params(delivery?: Partial<DeliveryContext>): OpenLiveSessionParams {
  return {
    phase: 'PART2',
    mode: 'exam',
    stimulus,
    timeRemainingMs: 300_000,
    delivery: delivery
      ? {
          level: 'intermédiaire',
          wordsPerMinute: 110,
          pauseCount: 1,
          fillerRate: 1,
          tenseVariety: 2,
          subordinationRate: 2,
          ...delivery,
        }
      : undefined,
    onStudentTranscript: () => {},
    onExaminerAudio: () => {},
    onExaminerQuestionText: () => {},
    onExaminerInterrupted: () => {},
    onTurnComplete: () => {},
    onError: () => {},
  };
}

describe('systemInstruction', () => {
  it('always forbids English and mid-session correction', () => {
    const prompt = systemInstruction(params());
    expect(prompt).toContain('UNIQUEMENT en français');
    expect(prompt).toContain('Tu ne corriges JAMAIS');
  });

  it('asks a strong student for hypothesis and nuance', () => {
    const prompt = systemInstruction(params({ level: 'fort', tenseVariety: 5 }));
    expect(prompt).toMatch(/conditionnel/);
    expect(prompt).toMatch(/hypoth/i);
  });

  it('asks a struggling student short concrete questions instead', () => {
    const prompt = systemInstruction(params({ level: 'fragile', pauseCount: 8 }));
    expect(prompt).toMatch(/courtes et concrètes/);
    expect(prompt).toMatch(/présent/);
    expect(prompt).not.toMatch(/abstraites/);
  });

  it('reports the measured signals so the model can act on the specific weakness', () => {
    const prompt = systemInstruction(params({ wordsPerMinute: 72, pauseCount: 6, fillerRate: 9 }));
    expect(prompt).toContain('72 mots/minute');
    expect(prompt).toContain('6 pause(s)');
    expect(prompt).toMatch(/hésitations/);
  });

  it('adds an explicit nudge when a struggling student is pausing heavily', () => {
    const prompt = systemInstruction(params({ level: 'fragile', pauseCount: 9 }));
    expect(prompt).toContain('IMPORTANT');
    expect(prompt).toMatch(/plus de temps/);
  });

  it('falls back to a sane pitch when nothing has been measured yet', () => {
    const prompt = systemInstruction(params());
    expect(prompt).toContain('intermédiaire');
    expect(prompt).not.toContain('undefined');
    expect(prompt).not.toContain('NaN');
  });

  it('carries the stimulus and prior transcript into context', () => {
    const p = params();
    p.priorTranscript = "J'ai parlé de ma famille.";
    const prompt = systemInstruction(p);
    expect(prompt).toContain('Des lycéens dans une salle de classe.');
    expect(prompt).toContain("J'ai parlé de ma famille.");
  });
});
