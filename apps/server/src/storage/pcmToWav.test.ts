import { describe, expect, it } from 'vitest';
import { pcmDurationMs, pcmToWav } from './pcmToWav.js';

/** One second of 16 kHz mono PCM16 = 16000 samples × 2 bytes. */
const ONE_SECOND_16K = Buffer.alloc(16000 * 2);

describe('pcmToWav', () => {
  it('writes a 44-byte canonical header ahead of the samples', () => {
    const wav = pcmToWav(ONE_SECOND_16K, 16000);
    expect(wav.length).toBe(44 + ONE_SECOND_16K.length);
    expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(wav.subarray(36, 40).toString('ascii')).toBe('data');
  });

  it('declares mono PCM at the sample rate it was given', () => {
    const wav = pcmToWav(ONE_SECOND_16K, 24000);
    expect(wav.readUInt16LE(20)).toBe(1); // format: PCM
    expect(wav.readUInt16LE(22)).toBe(1); // channels: mono
    expect(wav.readUInt32LE(24)).toBe(24000);
    expect(wav.readUInt32LE(28)).toBe(24000 * 2); // byte rate
    expect(wav.readUInt16LE(34)).toBe(16); // bits per sample
  });

  it('records chunk sizes that match the payload', () => {
    const wav = pcmToWav(ONE_SECOND_16K, 16000);
    expect(wav.readUInt32LE(4)).toBe(36 + ONE_SECOND_16K.length);
    expect(wav.readUInt32LE(40)).toBe(ONE_SECOND_16K.length);
  });
});

describe('pcmDurationMs', () => {
  it('reports one second for one second of audio at either sample rate', () => {
    expect(pcmDurationMs(ONE_SECOND_16K, 16000)).toBe(1000);
    expect(pcmDurationMs(Buffer.alloc(24000 * 2), 24000)).toBe(1000);
  });

  it('returns zero for an empty buffer rather than NaN', () => {
    expect(pcmDurationMs(Buffer.alloc(0), 16000)).toBe(0);
  });
});
