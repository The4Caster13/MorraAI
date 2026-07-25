import type { Phase, SessionMode, SessionStatus, WsServerMessage } from '@parlons/shared';
import { PART1_SECONDS_CAP, PART2_SECONDS_CAP, PART3_SECONDS_CAP } from '@parlons/shared';
import type {
  CompetenceEstimate,
  ExaminerService,
  LiveExaminerSession,
  StimulusContext,
} from '../examiner/ExaminerService.js';
import { sessionRepo, transcriptRepo } from '../db/repositories/index.js';
import { assertTransition, phaseForStatus } from './sessionMachine.js';
import { audioPath, getStorageService } from '../storage/StorageService.js';
import { pcmDurationMs, pcmToWav } from '../storage/pcmToWav.js';
import { scoreAndPersist } from '../scoring/scoreSession.js';

export type Emitter = (msg: WsServerMessage) => void;

const PHASE_CAPS_MS: Record<Phase, number> = {
  PART1: PART1_SECONDS_CAP * 1000,
  PART2: PART2_SECONDS_CAP * 1000,
  PART3: PART3_SECONDS_CAP * 1000,
};

const TENSE_MARKERS = [
  /\bj'ai \w+é\b/i, // passé composé
  /\bétai(s|t|ent)\b/i, // imparfait
  /\bser(ai|as|a|ons|ez|ont)\b/i, // futur
  /\b\w+rais\b/i, // conditionnel
  /\bque je \w+e\b/i, // subjonctif (rough)
];

interface PhaseAudio {
  student: Buffer[];
  examiner: Buffer[];
}

export class SessionRuntime {
  private emitter: Emitter | null = null;
  private examinerSession: LiveExaminerSession | null = null;
  private tickInterval: NodeJS.Timeout | null = null;
  private phaseDeadline = 0;
  private sessionStartMs = 0;
  private status: SessionStatus;
  private mode: SessionMode;
  private showText = false;
  private audio: Record<Phase, PhaseAudio> = {
    PART1: { student: [], examiner: [] },
    PART2: { student: [], examiner: [] },
    PART3: { student: [], examiner: [] },
  };
  private studentUtterances: string[] = [];
  private lowConfidenceSegments = 0;
  private closed = false;

  constructor(
    public readonly sessionId: string,
    status: SessionStatus,
    mode: SessionMode,
    private prepSecondsAllotted: number,
    private stimulus: StimulusContext,
    private examiner: ExaminerService,
  ) {
    this.status = status;
    this.mode = mode;
  }

  attach(emitter: Emitter, showText: boolean) {
    this.emitter = emitter;
    this.showText = showText && this.mode === 'practice';
  }

  detach() {
    this.emitter = null;
  }

  setShowText(show: boolean) {
    this.showText = show && this.mode === 'practice';
  }

  getStatus(): SessionStatus {
    return this.status;
  }

  private emit(msg: WsServerMessage) {
    this.emitter?.(msg);
  }

  private nowMs(): number {
    return Date.now() - this.sessionStartMs;
  }

  private async setStatus(next: SessionStatus) {
    assertTransition(this.status, next);
    this.status = next;
    const phase = phaseForStatus(next);
    await sessionRepo.update(this.sessionId, {
      status: next,
      currentPhase: phase,
      ...(next === 'PREP' ? { startedAt: new Date() } : {}),
      ...(next === 'COMPLETE' || next === 'ABANDONED' || next === 'ERROR'
        ? { endedAt: new Date() }
        : {}),
    });
    this.emit({ type: 'server:phaseChanged', phase, status: next });
  }

  // ---- Prep ----

  async startPrep() {
    await this.setStatus('PREP');
    this.sessionStartMs = Date.now();
    this.startCountdown(this.prepSecondsAllotted * 1000, null, () => void this.startPart1());
  }

  async skipPrep() {
    if (this.mode !== 'practice' || this.status !== 'PREP') return;
    this.stopCountdown();
    await this.startPart1();
  }

  // ---- Part 1 ----

  async startPart1() {
    if (this.status !== 'PREP') return;
    this.stopCountdown();
    await this.setStatus('PART1_INTRO');
    await this.openExaminerForPhase('PART1');
    await this.setStatus('PART1_RECORDING');
    this.startCountdown(PHASE_CAPS_MS.PART1, 'PART1', () => void this.hardStopPart1());
  }

  private async hardStopPart1() {
    if (this.status !== 'PART1_RECORDING') return;
    this.emit({ type: 'server:part1HardStop' });
    this.examinerSession?.requestClosing();
    await this.endPart1();
  }

  async endPart1() {
    if (this.status !== 'PART1_RECORDING') return;
    this.stopCountdown();
    await this.setStatus('PART1_CLOSING');
    await this.closePhase('PART1');
    await this.startQaPhase('PART2');
  }

  // ---- Parts 2 & 3 ----

  private async startQaPhase(phase: 'PART2' | 'PART3') {
    await this.setStatus(phase === 'PART2' ? 'PART2_QA' : 'PART3_QA');
    await this.openExaminerForPhase(phase);
    this.startCountdown(PHASE_CAPS_MS[phase], phase, () => void this.endQaPhase(phase));
  }

  private async endQaPhase(phase: 'PART2' | 'PART3') {
    this.stopCountdown();
    await this.closePhase(phase);
    if (phase === 'PART2') {
      await this.startQaPhase('PART3');
    } else {
      await this.finishAndScore();
    }
  }

  // ---- Examiner wiring ----

  private async openExaminerForPhase(phase: Phase) {
    const priorTranscript = this.studentUtterances.join('\n').slice(-6000);
    this.examinerSession = await this.examiner.openLiveSession({
      phase,
      mode: this.mode,
      stimulus: this.stimulus,
      priorTranscript: priorTranscript || undefined,
      competenceEstimate: this.competenceEstimate(),
      timeRemainingMs: PHASE_CAPS_MS[phase],
      onStudentTranscript: (seg) => {
        if (seg.isFinal) {
          this.studentUtterances.push(seg.text);
          if (seg.confidence !== null && seg.confidence < 0.6) this.lowConfidenceSegments += 1;
          const start = this.nowMs();
          void transcriptRepo
            .add({
              sessionId: this.sessionId,
              phase,
              speaker: 'STUDENT',
              text: seg.text,
              startMs: start,
              endMs: start,
              sttConfidence: seg.confidence,
            })
            .catch((err) => console.error('transcript persist failed', err));
        }
        this.emit({
          type: 'server:studentTranscript',
          phase,
          text: seg.text,
          isFinal: seg.isFinal,
          confidence: seg.confidence,
        });
      },
      onExaminerAudio: (pcm16) => {
        this.audio[phase].examiner.push(pcm16);
        this.emit({
          type: 'server:examinerAudioChunk',
          seq: this.audio[phase].examiner.length,
          pcm16Base64: pcm16.toString('base64'),
          sampleRate: 24000,
        });
      },
      onExaminerQuestionText: (text) => {
        const start = this.nowMs();
        void transcriptRepo
          .add({
            sessionId: this.sessionId,
            phase,
            speaker: 'EXAMINER',
            text,
            startMs: start,
            endMs: start,
            sttConfidence: null,
          })
          .catch((err) => console.error('transcript persist failed', err));
        // Withholding the text is only realistic when the student can hear the
        // question instead. A silent examiner must always be readable.
        if (this.showText || !this.examiner.speaksAloud) {
          this.emit({ type: 'server:questionText', text });
        }
      },
      onExaminerInterrupted: () => this.emit({ type: 'server:examinerInterrupted' }),
      onTurnComplete: () => {},
      onError: (err) => {
        console.error(`examiner error in ${phase}`, err);
        this.emit({
          type: 'server:error',
          code: 'EXAMINER_ERROR',
          message: err.message,
          recoverable: true,
        });
      },
    });
  }

  private async closePhase(phase: Phase) {
    await this.examinerSession?.close();
    this.examinerSession = null;
    await this.persistPhaseAudio(phase);
  }

  private async persistPhaseAudio(phase: Phase) {
    const storage = getStorageService();
    for (const speaker of ['STUDENT', 'EXAMINER'] as const) {
      const chunks = this.audio[phase][speaker === 'STUDENT' ? 'student' : 'examiner'];
      if (chunks.length === 0) continue;
      const pcm = Buffer.concat(chunks);
      const sampleRate = speaker === 'STUDENT' ? 16000 : 24000;
      const wav = pcmToWav(pcm, sampleRate);
      const path = audioPath(this.sessionId, phase, speaker);
      try {
        await storage.uploadAudio(path, wav);
        await transcriptRepo.addAudioFile({
          sessionId: this.sessionId,
          phase,
          speaker,
          filePath: path,
          durationMs: pcmDurationMs(pcm, sampleRate),
        });
      } catch (err) {
        console.error(`audio persist failed for ${path}`, err);
      }
    }
  }

  // ---- Client inputs ----

  handleAudioChunk(phase: Phase, pcm16Base64: string) {
    if (phaseForStatus(this.status) !== phase) return;
    const pcm = Buffer.from(pcm16Base64, 'base64');
    this.audio[phase].student.push(pcm);
    this.examinerSession?.sendStudentAudioChunk(pcm);
  }

  handleDebugStudentText(phase: Phase, text: string) {
    if (phaseForStatus(this.status) !== phase) return;
    this.examinerSession?.sendStudentText?.(text);
  }

  requestRephrase() {
    this.examinerSession?.requestRephrase();
  }

  async handleNotepadUpdate(bullets: string[]) {
    if (this.status !== 'PREP') return;
    await sessionRepo.update(this.sessionId, { notepadBullets: bullets });
  }

  async endSessionEarly() {
    this.stopCountdown();
    const phase = phaseForStatus(this.status);
    if (phase) await this.closePhase(phase);
    if (this.status === 'PART3_QA') {
      await this.finishAndScore();
      return;
    }
    await this.setStatus('ABANDONED');
    await this.cleanup();
  }

  // ---- Scoring ----

  private async finishAndScore() {
    await this.setStatus('SCORING');
    try {
      await scoreAndPersist(this.sessionId, this.stimulus, this.mode, this.examiner, {
        lowConfidenceSegments: this.lowConfidenceSegments,
      });
      await this.setStatus('COMPLETE');
      this.emit({ type: 'server:sessionComplete', sessionId: this.sessionId });
    } catch (err) {
      console.error('scoring failed', err);
      await this.setStatus('ERROR');
      this.emit({
        type: 'server:error',
        code: 'SCORING_FAILED',
        message: err instanceof Error ? err.message : 'Scoring failed',
        recoverable: false,
      });
    }
    await this.cleanup();
  }

  // ---- Timers ----

  private startCountdown(durationMs: number, phase: Phase | null, onExpiry: () => void) {
    this.stopCountdown();
    this.phaseDeadline = Date.now() + durationMs;
    this.tickInterval = setInterval(() => {
      const remainingMs = Math.max(0, this.phaseDeadline - Date.now());
      this.emit({ type: 'server:timerTick', phase, remainingMs });
      if (remainingMs <= 0) {
        this.stopCountdown();
        onExpiry();
      }
    }, 1000);
  }

  private stopCountdown() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  // ---- Competence heuristic ----

  private competenceEstimate(): CompetenceEstimate {
    const utterances = this.studentUtterances;
    if (utterances.length === 0) return { A: 0.5, B1: 0.5, B2: 0.5, C: 0.5 };
    const text = utterances.join(' ');
    const words = text.split(/\s+/).filter(Boolean);
    const avgLen = words.length / utterances.length;
    const lengthSignal = Math.min(1, avgLen / 40);
    const tenseVariety =
      TENSE_MARKERS.filter((re) => re.test(text)).length / TENSE_MARKERS.length;
    const a = 0.5 * lengthSignal + 0.5 * tenseVariety;
    return {
      A: round2(a),
      B1: round2(lengthSignal),
      B2: round2(lengthSignal),
      C: round2(Math.min(1, utterances.length / 10)),
    };
  }

  async cleanup() {
    if (this.closed) return;
    this.closed = true;
    this.stopCountdown();
    await this.examinerSession?.close();
    this.examinerSession = null;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---- Registry ----

const runtimes = new Map<string, SessionRuntime>();

export function getRuntime(sessionId: string): SessionRuntime | undefined {
  return runtimes.get(sessionId);
}

export function registerRuntime(runtime: SessionRuntime): void {
  runtimes.set(runtime.sessionId, runtime);
}

export async function disposeRuntime(sessionId: string): Promise<void> {
  const rt = runtimes.get(sessionId);
  if (rt) {
    await rt.cleanup();
    runtimes.delete(sessionId);
  }
}
