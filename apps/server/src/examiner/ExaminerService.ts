import type { Criterion, Phase, SessionMode, TranscriptSegmentDto } from '@parlons/shared';

export type CompetenceEstimate = Record<Criterion, number>; // 0-1 rough signal

/** Measured delivery signals, used to pitch question difficulty. */
export interface DeliveryContext {
  level: 'fragile' | 'intermédiaire' | 'fort';
  wordsPerMinute: number | null;
  pauseCount: number;
  fillerRate: number;
  tenseVariety: number;
  subordinationRate: number;
}

export interface StimulusContext {
  id: string;
  theme: string;
  subtopic: string;
  captionFr: string;
  culturalLinkFr: string;
}

export interface TranscriptChunk {
  text: string;
  isFinal: boolean;
  confidence: number | null;
}

export interface OpenLiveSessionParams {
  phase: Phase;
  mode: SessionMode;
  stimulus: StimulusContext;
  priorTranscript?: string;
  competenceEstimate?: CompetenceEstimate;
  delivery?: DeliveryContext;
  timeRemainingMs: number;
  onStudentTranscript(seg: TranscriptChunk): void;
  onExaminerAudio(pcm16: Buffer): void;
  onExaminerQuestionText(text: string): void;
  onExaminerInterrupted(): void;
  onTurnComplete(): void;
  onError(err: Error): void;
}

export interface LiveExaminerSession {
  sendStudentAudioChunk(pcm16: Buffer): void;
  /** Mock-mode text path: lets a developer "speak" by typing. */
  sendStudentText?(text: string): void;
  requestRephrase(): void;
  /** Ask the examiner to wrap up (e.g. Part 1 hard stop courtesy line). */
  requestClosing(): void;
  close(): Promise<void>;
}

export interface CriterionScore {
  mark: number;
  band: string;
  justification: string;
  evidenceQuotes: string[];
}

export interface ScoreSessionInput {
  fullTranscript: TranscriptSegmentDto[];
  stimulus: StimulusContext;
  mode: SessionMode;
  sttConfidenceSummary: { avg: number | null; lowConfidenceSegmentIds: string[] };
  /**
   * Measured delivery. A transcript cannot show pace, hesitation or pausing,
   * all of which Criterion A explicitly assesses — without this the model is
   * guessing at fluency from punctuation.
   */
  delivery?: {
    wordsPerMinute: number | null;
    speechMs: number;
    pauseCount: number;
    longestPauseMs: number;
    fillerRate: number;
    tenseVariety: number;
    subordinationRate: number;
    lexicalDiversity: number;
  };
}

export interface ScoreSessionResult {
  criterionA: CriterionScore;
  criterionB1: CriterionScore;
  criterionB2: CriterionScore;
  criterionC: CriterionScore;
  strengths: [string, string, string];
  priorities: [string, string, string];
  drills: string[];
  uncertaintyNote: string | null;
}

export interface ExaminerService {
  /**
   * Whether this examiner produces real, audible speech.
   *
   * Question text is normally withheld from the student for exam realism — they
   * are meant to listen, not read. That only holds if there is something to
   * listen to: the mock examiner emits silence, so withholding the text as well
   * leaves the student with no examiner at all.
   */
  readonly speaksAloud: boolean;
  openLiveSession(params: OpenLiveSessionParams): Promise<LiveExaminerSession>;
  scoreSession(input: ScoreSessionInput): Promise<ScoreSessionResult>;
}
