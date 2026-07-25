import { describe, expect, it } from 'vitest';
import { wsClientMessageSchema, wsServerMessageSchema } from './ws.js';

describe('ws contract', () => {
  it('round-trips a client audio chunk', () => {
    const msg = {
      type: 'client:audioChunk' as const,
      phase: 'PART1' as const,
      seq: 3,
      pcm16Base64: 'AAAA',
      sampleRate: 16000 as const,
    };
    const parsed = wsClientMessageSchema.parse(JSON.parse(JSON.stringify(msg)));
    expect(parsed).toEqual(msg);
  });

  it('round-trips a server examiner audio chunk', () => {
    const msg = {
      type: 'server:examinerAudioChunk' as const,
      seq: 1,
      pcm16Base64: 'AAAA',
      sampleRate: 24000 as const,
    };
    expect(wsServerMessageSchema.parse(JSON.parse(JSON.stringify(msg)))).toEqual(msg);
  });

  it('rejects a wrong client sample rate', () => {
    const bad = {
      type: 'client:audioChunk',
      phase: 'PART1',
      seq: 0,
      pcm16Base64: '',
      sampleRate: 44100,
    };
    expect(wsClientMessageSchema.safeParse(bad).success).toBe(false);
  });

  it('caps notepad bullets at ten', () => {
    const ok = { type: 'client:notepadUpdate', bullets: Array(10).fill('note') };
    const tooMany = { type: 'client:notepadUpdate', bullets: Array(11).fill('note') };
    expect(wsClientMessageSchema.safeParse(ok).success).toBe(true);
    expect(wsClientMessageSchema.safeParse(tooMany).success).toBe(false);
  });

  it('rejects unknown message types', () => {
    expect(wsClientMessageSchema.safeParse({ type: 'client:hack' }).success).toBe(false);
    expect(wsServerMessageSchema.safeParse({ type: 'server:hack' }).success).toBe(false);
  });
});
