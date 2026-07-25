/**
 * Minimal PCM16 → WAV container helpers.
 *
 * Audio arrives from the browser (16 kHz) and from Gemini (24 kHz) as raw
 * little-endian signed 16-bit mono PCM. Browsers will not play raw PCM from a
 * URL, so we prepend a 44-byte canonical WAV header before persisting.
 */

const HEADER_BYTES = 44;
const BITS_PER_SAMPLE = 16;
const CHANNELS = 1;

/** Wraps raw mono PCM16 in a canonical 44-byte WAV header. */
export function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const byteRate = (sampleRate * CHANNELS * BITS_PER_SAMPLE) / 8;
  const blockAlign = (CHANNELS * BITS_PER_SAMPLE) / 8;
  const header = Buffer.alloc(HEADER_BYTES);

  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4); // file size minus the first 8 bytes
  header.write('WAVE', 8, 'ascii');

  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // audio format 1 = PCM
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);

  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

/** Duration of a raw PCM16 mono buffer, in milliseconds. */
export function pcmDurationMs(pcm: Buffer, sampleRate: number): number {
  const bytesPerSample = (BITS_PER_SAMPLE / 8) * CHANNELS;
  if (sampleRate <= 0) return 0;
  return Math.round((pcm.length / bytesPerSample / sampleRate) * 1000);
}
