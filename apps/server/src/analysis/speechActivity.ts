/**
 * Energy-based voice activity detection over the raw microphone stream.
 *
 * The browser sends 16 kHz mono PCM16 continuously, including while the student
 * is silent, so wall-clock time says nothing about how long they actually
 * spoke. Splitting the stream into speaking and silent runs is what makes
 * speech rate and pause length measurable at all.
 *
 * This is deliberately a simple RMS gate rather than a trained VAD: it runs on
 * every chunk in the hot path, and the downstream use (nudging examiner
 * difficulty, describing fluency in a report) tolerates approximation. It is
 * not used to decide when the examiner speaks — Gemini's own endpointing does
 * that.
 */

const BYTES_PER_SAMPLE = 2;

/** Root-mean-square amplitude of a PCM16 buffer, normalised to 0–1. */
export function rms(pcm16: Buffer): number {
  const sampleCount = Math.floor(pcm16.length / BYTES_PER_SAMPLE);
  if (sampleCount === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < sampleCount; i++) {
    const sample = pcm16.readInt16LE(i * BYTES_PER_SAMPLE) / 0x8000;
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / sampleCount);
}

export function durationMs(pcm16: Buffer, sampleRate: number): number {
  if (sampleRate <= 0) return 0;
  return (pcm16.length / BYTES_PER_SAMPLE / sampleRate) * 1000;
}

export interface SpeechActivity {
  /** Milliseconds of detected speech. */
  speechMs: number;
  /** Milliseconds of detected silence, excluding leading silence. */
  silenceMs: number;
  /** Pauses longer than PAUSE_THRESHOLD_MS that fall between speech. */
  pauses: number[];
  longestPauseMs: number;
}

/** Below this RMS a chunk counts as silence. Empirical, for a headset mic. */
const SILENCE_RMS = 0.012;
/** Shorter gaps are the natural rhythm of speech, not hesitation. */
export const PAUSE_THRESHOLD_MS = 700;

export class SpeechActivityTracker {
  private speechMs = 0;
  private silenceMs = 0;
  private pauses: number[] = [];
  private currentSilenceMs = 0;
  private hasSpokenYet = false;

  /** Feeds one chunk of the student's microphone stream. */
  push(pcm16: Buffer, sampleRate = 16000): void {
    const ms = durationMs(pcm16, sampleRate);
    if (ms === 0) return;

    if (rms(pcm16) >= SILENCE_RMS) {
      // A silent run only counts as a pause once speech resumes — otherwise a
      // student still gathering their thoughts is penalised for the wait.
      if (this.hasSpokenYet && this.currentSilenceMs >= PAUSE_THRESHOLD_MS) {
        this.pauses.push(this.currentSilenceMs);
      }
      this.currentSilenceMs = 0;
      this.hasSpokenYet = true;
      this.speechMs += ms;
    } else if (this.hasSpokenYet) {
      this.currentSilenceMs += ms;
      this.silenceMs += ms;
    }
  }

  snapshot(): SpeechActivity {
    return {
      speechMs: Math.round(this.speechMs),
      silenceMs: Math.round(this.silenceMs),
      pauses: [...this.pauses],
      longestPauseMs: this.pauses.length > 0 ? Math.round(Math.max(...this.pauses)) : 0,
    };
  }
}
