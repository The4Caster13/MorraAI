import type { Phase, SessionMode, SessionStatus, WsServerMessage } from '@parlons/shared';
import { PART1_SECONDS_CAP, PART2_SECONDS_CAP, PART3_SECONDS_CAP } from '@parlons/shared';
import type {
  ExaminerService,
  LiveExaminerSession,
  StimulusContext,
} from '../examiner/ExaminerService.js';
import { analyseLanguage } from '../analysis/languageMetrics.js';
import { SpeechActivityTracker } from '../analysis/speechActivity.js';
import {
  estimateCompetence,
  initialCompetence,
  type CompetenceSnapshot,
} from '../analysis/competence.js';
import { sessionRepo, transcriptRepo } from '../db/repositories/index.js';
import { assertTransition, isTerminal, phaseForStatus } from './sessionMachine.js';
import { audioPath, getStorageService } from '../storage/StorageService.js';
import { pcmDurationMs, pcmToWav } from '../storage/pcmToWav.js';
import { scoreAndPersist } from '../scoring/scoreSession.js';

export type Emitter = (msg: WsServerMessage) => void;

const PHASE_CAPS_MS: Record<Phase, number> = {
  PART1: PART1_SECONDS_CAP * 1000,
  PART2: PART2_SECONDS_CAP * 1000,
  PART3: PART3_SECONDS_CAP * 1000,
};

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
  /** Set when the student ends the session before Part 3 has run its course. */
  private endedEarlyAt: Phase | null = null;
  private speech = new SpeechActivityTracker();
  /**
   * Whether the examiner has ever produced audible speech this session. Until
   * it has, question text is shown regardless of mode — an examiner nobody can
   * hear or read is not an exam.
   */
  private audioHasArrived = false;

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

  /**
   * Runs state-machine work one item at a time.
   *
   * Transitions span multiple awaited DB writes, so without this a second event
   * (a double-click, or the phase timer firing while the student ends the phase
   * manually) interleaves and drives the session somewhere the first operation
   * no longer expects — e.g. one path sets ABANDONED while another is still
   * mid-way through advancing to PART2_QA.
   */
  private chain: Promise<unknown> = Promise.resolve();

  /**
   * Re-reads the status after an await. Called as a method so TypeScript does
   * not narrow it to the value an earlier guard proved — `setStatus` mutates it.
   */
  private statusNow(): SessionStatus {
    return this.status;
  }

  private serialize<T>(fn: () => Promise<T>): Promise<T | undefined> {
    const run = this.chain.then(
      () => fn(),
      () => fn(),
    );
    this.chain = run.catch(() => undefined);
    return run;
  }

  /**
   * The in-memory `status` is already what the live WS gateway trusts (see
   * `syncStatusIfIdle`), so it — not the DB row — is the real-time source of
   * truth for a connected client. The DB write exists only for durability
   * (history, resuming a lookup after this process restarts), so it must not
   * gate the UI on a network round trip. Not `async`: the transition and the
   * client notification both happen synchronously; the persistence write is
   * fired in the background and merely logged if it fails.
   *
   * If the process crashes between the in-memory transition and the write
   * landing, the persisted row can lag one step behind — acceptable, since an
   * in-flight session already isn't resumable across a restart (see index.ts).
   */
  private setStatus(next: SessionStatus): void {
    assertTransition(this.status, next);
    this.status = next;
    const phase = phaseForStatus(next);
    this.emit({ type: 'server:phaseChanged', phase, status: next });
    sessionRepo
      .update(this.sessionId, {
        status: next,
        currentPhase: phase,
        ...(next === 'PREP' ? { startedAt: new Date() } : {}),
        ...(next === 'COMPLETE' || next === 'ABANDONED' || next === 'ERROR'
          ? { endedAt: new Date() }
          : {}),
      })
      .catch((err) => {
        console.error(`failed to persist status ${next} for session ${this.sessionId}`, err);
      });
  }

  // ---- Prep ----

  async startPrep() {
    await this.serialize(async () => {
      if (this.status !== 'CONSENTED') return;
      this.setStatus('PREP');
      this.sessionStartMs = Date.now();
      this.startCountdown(this.prepSecondsAllotted * 1000, null, () =>
        void this.serialize(() => this.startPart1Locked()),
      );
    });
  }

  async skipPrep() {
    await this.serialize(async () => {
      if (this.mode !== 'practice' || this.status !== 'PREP') return;
      await this.startPart1Locked();
    });
  }

  // ---- Part 1 ----

  async startPart1() {
    await this.serialize(() => this.startPart1Locked());
  }

  private async startPart1Locked() {
    if (this.status !== 'PREP') return;
    this.stopCountdown();
    this.setStatus('PART1_INTRO');
    await this.openExaminerForPhase('PART1');
    // Re-check: the session may have been abandoned while the examiner connected.
    if (this.statusNow() !== 'PART1_INTRO') return;
    this.setStatus('PART1_RECORDING');
    this.startCountdown(PHASE_CAPS_MS.PART1, 'PART1', () =>
      void this.serialize(() => this.hardStopPart1Locked()),
    );
  }

  private async hardStopPart1Locked() {
    if (this.status !== 'PART1_RECORDING') return;
    this.emit({ type: 'server:part1HardStop' });
    this.examinerSession?.requestClosing();
    await this.endPart1Locked();
  }

  /**
   * "I have finished presenting." Advances Part 1 to Part 2 and does nothing in
   * any other phase, so repeat presses are harmless.
   */
  async finishPresentation() {
    await this.serialize(() => this.endPart1Locked());
  }

  private async endPart1Locked() {
    if (this.status !== 'PART1_RECORDING') return;
    this.stopCountdown();
    this.setStatus('PART1_CLOSING');
    await this.closePhase('PART1');
    if (this.statusNow() !== 'PART1_CLOSING') return;
    await this.startQaPhaseLocked('PART2');
  }

  // ---- Parts 2 & 3 ----

  private async startQaPhaseLocked(phase: 'PART2' | 'PART3') {
    this.setStatus(phase === 'PART2' ? 'PART2_QA' : 'PART3_QA');
    await this.openExaminerForPhase(phase);
    if (phaseForStatus(this.status) !== phase) return;
    this.startCountdown(PHASE_CAPS_MS[phase], phase, () =>
      void this.serialize(() => this.endQaPhaseLocked(phase)),
    );
  }

  private async endQaPhaseLocked(phase: 'PART2' | 'PART3') {
    if (phaseForStatus(this.status) !== phase) return;
    this.stopCountdown();
    await this.closePhase(phase);
    if (phaseForStatus(this.status) !== phase) return;
    if (phase === 'PART2') {
      await this.startQaPhaseLocked('PART3');
    } else {
      await this.finishAndScoreLocked();
    }
  }

  // ---- Examiner wiring ----

  private async openExaminerForPhase(phase: Phase) {
    const priorTranscript = this.studentUtterances.join('\n').slice(-6000);
    const competence = this.competence();
    this.examinerSession = await this.examiner.openLiveSession({
      phase,
      mode: this.mode,
      stimulus: this.stimulus,
      priorTranscript: priorTranscript || undefined,
      competenceEstimate: competence.estimate,
      delivery: {
        level: competence.level,
        wordsPerMinute: competence.delivery.wordsPerMinute,
        pauseCount: competence.delivery.pauseCount,
        fillerRate: competence.delivery.fillerRate,
        tenseVariety: competence.delivery.tenseVariety,
        subordinationRate: competence.delivery.subordinationRate,
      },
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
        // A completed utterance is the only thing that moves the estimate.
        if (seg.isFinal) this.emitCompetence();
      },
      onExaminerAudio: (pcm16) => {
        this.audioHasArrived = true;
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
        // question instead. If no audio has arrived — a mute Live model, a
        // broken voice config — showing the text is the difference between a
        // usable exam and a blank screen.
        if (this.showText || !this.examiner.speaksAloud || !this.audioHasArrived) {
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
    // Voice activity is measured here, on the raw stream, because it's the only
    // place the difference between speaking and silence is observable.
    this.speech.push(pcm);
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

  /**
   * The student deliberately ended the session. What that means depends on the
   * phase, so the decision is made inside the lock — deciding it in the gateway
   * read a status that could already be stale by the time the work ran.
   */
  async requestEnd() {
    await this.serialize(async () => {
      if (isTerminal(this.status) || this.status === 'SCORING') return;

      // Both Q&A phases are worth scoring. Part 3 is a complete exam; stopping
      // during Part 2 still leaves a presentation and a discussion behind, which
      // is a useful report so long as it says the session was cut short.
      // Discarding it would lose the whole attempt over a single click.
      if (this.status === 'PART2_QA' || this.status === 'PART3_QA') {
        const phase = this.status === 'PART2_QA' ? 'PART2' : 'PART3';
        if (phase === 'PART2') this.endedEarlyAt = 'PART2';
        this.stopCountdown();
        await this.closePhase(phase);
        await this.finishAndScoreLocked();
        return;
      }
      await this.abandonLocked();
    });
  }

  private async abandonLocked() {
    if (isTerminal(this.status)) return;
    this.stopCountdown();
    const phase = phaseForStatus(this.status);
    if (phase) await this.closePhase(phase);
    if (isTerminal(this.status)) return;
    this.setStatus('ABANDONED');
    await this.cleanup();
  }

  // ---- Scoring ----

  private async finishAndScoreLocked() {
    if (isTerminal(this.status) || this.status === 'SCORING') return;
    this.setStatus('SCORING');
    try {
      await scoreAndPersist(this.sessionId, this.stimulus, this.mode, this.examiner, {
        lowConfidenceSegments: this.lowConfidenceSegments,
        endedEarlyAt: this.endedEarlyAt,
      });
      this.setStatus('COMPLETE');
      this.emit({ type: 'server:sessionComplete', sessionId: this.sessionId });
    } catch (err) {
      console.error('scoring failed', err);
      this.setStatus('ERROR');
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

  // ---- Competence ----

  /**
   * Current read on the student, from measured delivery plus transcript
   * analysis. Recomputed rather than cached: it's cheap, and every caller wants
   * the state as of now.
   */
  private competence(): CompetenceSnapshot {
    if (this.studentUtterances.length === 0) return initialCompetence();
    return estimateCompetence(
      analyseLanguage(this.studentUtterances.join(' ')),
      this.speech.snapshot(),
      this.studentUtterances.length,
    );
  }

  /** Pushes the current estimate to the client so adaptation is visible. */
  private emitCompetence(): void {
    const c = this.competence();
    this.emit({
      type: 'server:competenceUpdate',
      level: c.level,
      wordsPerMinute: c.delivery.wordsPerMinute,
      pauseCount: c.delivery.pauseCount,
      fillerRate: c.delivery.fillerRate,
      tenseVariety: c.delivery.tenseVariety,
    });
  }

  async cleanup() {
    if (this.closed) return;
    this.closed = true;
    this.stopCountdown();
    await this.examinerSession?.close();
    this.examinerSession = null;
  }
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
