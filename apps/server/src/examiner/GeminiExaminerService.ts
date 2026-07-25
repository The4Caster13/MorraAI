import { GoogleGenAI, Modality, type Session } from '@google/genai';
import { env } from '../config/env.js';
import { buildScoringPrompt, scoringResponseJsonSchema, scoringResponseSchema } from '../scoring/promptBuilder.js';
import type {
  ExaminerService,
  LiveExaminerSession,
  OpenLiveSessionParams,
  ScoreSessionInput,
  ScoreSessionResult,
} from './ExaminerService.js';

/** Sentence-final punctuation, used to segment a long uninterrupted monologue. */
const SENTENCE_END = /[.!?…]\s*$/;
/** Don't cut on an early "M." or "etc." — wait for a reasonable chunk first. */
const MIN_SEGMENT_CHARS = 40;

const PHASE_BRIEFS: Record<string, string> = {
  PART1:
    "L'étudiant présente le stimulus visuel pendant 3 à 4 minutes. Écoute sans interrompre. N'interviens que si on te le demande explicitement.",
  PART2:
    "Tu poses des questions sur la présentation et le stimulus. Chaque question doit reprendre quelque chose que l'étudiant vient de dire.",
  PART3:
    "Tu élargis la conversation à d'autres thèmes du programme, en gardant un lien avec les intérêts que l'étudiant a montrés.",
};

/**
 * How the examiner should pitch its questions at each measured level.
 *
 * The point of the adaptive loop is to give every student room to show their
 * ceiling: a struggling student stops producing anything usable if the
 * questions are abstract, and a strong one can't reach the top bands if never
 * asked anything that needs a conditional or a subjunctive.
 */
const DIFFICULTY_BRIEFS: Record<string, string> = {
  fort:
    "Pousse cet étudiant : questions abstraites, comparatives ou hypothétiques qui appellent " +
    "naturellement le conditionnel et le subjonctif (« Que feriez-vous si… », « Pensez-vous qu'il " +
    "soit… », « En quoi cela diffère-t-il de… »). Demande-lui de justifier et de nuancer.",
  intermédiaire:
    "Questions claires qui invitent à développer : demande des exemples concrets, des raisons, " +
    "une opinion personnelle. Relance sur un détail qu'il vient de mentionner plutôt que de " +
    'changer de sujet.',
  fragile:
    "Questions courtes et concrètes, au présent, une idée à la fois. Reprends ses propres mots. " +
    "Reformule spontanément s'il hésite longuement, sans jamais traduire ni corriger.",
};

export function systemInstruction(params: OpenLiveSessionParams): string {
  const d = params.delivery;
  const level = d?.level ?? 'intermédiaire';
  const difficulty = DIFFICULTY_BRIEFS[level] ?? DIFFICULTY_BRIEFS.intermédiaire;

  // Observed signals are stated plainly so the model can act on the specific
  // weakness rather than a single opaque label.
  const observations: string[] = [];
  if (d) {
    if (d.wordsPerMinute !== null) observations.push(`débit ≈ ${d.wordsPerMinute} mots/minute`);
    if (d.pauseCount > 0) observations.push(`${d.pauseCount} pause(s) marquée(s)`);
    if (d.fillerRate > 3) observations.push(`beaucoup d'hésitations (${d.fillerRate}/100 mots)`);
    if (d.tenseVariety > 0) observations.push(`${d.tenseVariety} temps verbaux différents employés`);
    if (d.subordinationRate > 3) observations.push('phrases complexes, subordination fréquente');
  }

  const adaptation =
    level === 'fragile' && (d?.pauseCount ?? 0) > 4
      ? "\nIMPORTANT : l'étudiant hésite beaucoup. Laisse-lui plus de temps, simplifie encore, et " +
        'commence par une question très concrète sur ce qu’il voit.'
      : level === 'fort' && (d?.tenseVariety ?? 0) >= 4
        ? "\nIMPORTANT : l'étudiant maîtrise plusieurs temps. Ne te contente pas de questions " +
          'descriptives — pousse vers l’hypothèse, la comparaison et le jugement personnel.'
        : '';

  return `Tu es un examinateur d'entraînement pour l'oral individuel de français B (niveau moyen).

RÈGLES ABSOLUES :
- Tu parles UNIQUEMENT en français, jamais en anglais, quelles que soient les circonstances.
- Tu ne corriges JAMAIS l'étudiant pendant la session et tu ne commentes jamais ses erreurs.
- Tes questions sont ouvertes et bienveillantes ; une seule question à la fois.
- Tu restes bref : une ou deux phrases maximum par tour de parole.
- Si l'étudiant demande une répétition, reformule plus simplement sans jamais traduire.

PHASE ACTUELLE : ${params.phase}. ${PHASE_BRIEFS[params.phase]}

NIVEAU MESURÉ DE L'ÉTUDIANT : ${level}.
${observations.length > 0 ? `Signaux observés : ${observations.join(', ')}.` : ''}
${difficulty}${adaptation}

STIMULUS VISUEL : « ${params.stimulus.captionFr} » (thème : ${params.stimulus.theme}, sous-thème : ${params.stimulus.subtopic}).
Lien culturel : ${params.stimulus.culturalLinkFr}
${params.priorTranscript ? `\nCE QUE L'ÉTUDIANT A DÉJÀ DIT :\n${params.priorTranscript}` : ''}`;
}

class GeminiLiveSession implements LiveExaminerSession {
  private closed = false;

  /**
   * Gemini streams transcription in fragments, so both directions are buffered
   * and flushed at turn boundaries. Without this, every fragment would be
   * emitted as its own utterance: the student's speech would never be marked
   * final (and so never persisted, leaving the scorer with no evidence), and
   * the examiner's questions would be shredded into dozens of transcript rows.
   */
  private studentBuffer = '';
  private examinerBuffer = '';

  constructor(
    private session: Session,
    private params: OpenLiveSessionParams,
  ) {}

  /** Accumulates a student transcription fragment and emits an interim caption. */
  appendStudentFragment(text: string): void {
    this.studentBuffer += text;

    // Part 1 is a 3–4 minute monologue with no examiner turn to close it out, so
    // segment on sentence boundaries instead — otherwise the whole presentation
    // arrives as one unbroken row at phase close.
    if (SENTENCE_END.test(this.studentBuffer) && this.studentBuffer.length >= MIN_SEGMENT_CHARS) {
      this.flushStudentTurn();
      return;
    }

    this.params.onStudentTranscript({
      text: this.studentBuffer.trim(),
      isFinal: false,
      confidence: null,
    });
  }

  /** Marks the student's utterance complete so it is persisted for scoring. */
  flushStudentTurn(): void {
    const text = this.studentBuffer.trim();
    this.studentBuffer = '';
    if (!text) return;
    this.params.onStudentTranscript({ text, isFinal: true, confidence: null });
  }

  appendExaminerFragment(text: string): void {
    this.examinerBuffer += text;
  }

  /** Emits the examiner's question as a single utterance once its turn ends. */
  flushExaminerTurn(): void {
    const text = this.examinerBuffer.trim();
    this.examinerBuffer = '';
    if (!text) return;
    this.params.onExaminerQuestionText(text);
  }

  hasPendingStudentSpeech(): boolean {
    return this.studentBuffer.trim().length > 0;
  }

  sendStudentAudioChunk(pcm16: Buffer): void {
    if (this.closed) return;
    this.session.sendRealtimeInput({
      audio: { data: pcm16.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
    });
  }

  requestRephrase(): void {
    if (this.closed) return;
    this.session.sendClientContent({
      turns: [
        {
          role: 'user',
          parts: [
            {
              text: "[Instruction système] L'étudiant demande une répétition. Reformule ta dernière question plus simplement, en français, sans traduire.",
            },
          ],
        },
      ],
      turnComplete: true,
    });
  }

  requestClosing(): void {
    if (this.closed) return;
    this.session.sendClientContent({
      turns: [
        {
          role: 'user',
          parts: [
            {
              text: `[Instruction système] Le temps de cette partie est écoulé. Remercie brièvement l'étudiant et annonce le passage à la suite, en français.`,
            },
          ],
        },
      ],
      turnComplete: true,
    });
  }

  /**
   * Nudges the examiner to open a phase with its first question.
   *
   * Deliberately NOT called on every turn: Gemini Live's own voice-activity
   * detection decides when the student has stopped speaking and responds by
   * itself. Prompting on each `turnComplete` made the examiner answer its own
   * turn and fire questions back to back without waiting for the student.
   */
  promptNextQuestion(timeRemainingMs: number): void {
    if (this.closed || this.params.phase === 'PART1') return;
    const minutes = Math.max(0, Math.round(timeRemainingMs / 60000));
    this.session.sendClientContent({
      turns: [
        {
          role: 'user',
          parts: [
            {
              text: `[Instruction système] Il reste environ ${minutes} minute(s) pour cette partie. Pose ta prochaine question en reprenant ce que l'étudiant vient de dire.`,
            },
          ],
        },
      ],
      turnComplete: true,
    });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    // Salvage whatever was mid-utterance so the last answer still reaches the scorer.
    this.flushStudentTurn();
    this.flushExaminerTurn();
    this.closed = true;
    this.session.close();
  }
}

/** Exposed for unit tests only — not part of the ExaminerService contract. */
export const __testing = { GeminiLiveSession };

export class GeminiExaminerService implements ExaminerService {
  readonly speaksAloud = true;

  private ai: GoogleGenAI;

  constructor() {
    if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required for GeminiExaminerService');
    this.ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }

  async openLiveSession(params: OpenLiveSessionParams): Promise<LiveExaminerSession> {
    let liveSession: GeminiLiveSession | null = null;

    const session = await this.ai.live.connect({
      model: env.GEMINI_LIVE_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: systemInstruction(params),
      },
      callbacks: {
        onmessage: (message) => {
          const content = message.serverContent;
          if (!content) return;

          if (content.interrupted) params.onExaminerInterrupted();

          const inputText = content.inputTranscription?.text;
          if (inputText) liveSession?.appendStudentFragment(inputText);

          const outputText = content.outputTranscription?.text;
          if (outputText) {
            // The model has taken the floor, so the student's turn is over.
            if (liveSession?.hasPendingStudentSpeech()) liveSession.flushStudentTurn();
            liveSession?.appendExaminerFragment(outputText);
          }

          // `message.data` concatenates every inline-data part the SDK found,
          // which is more robust than walking modelTurn.parts ourselves — the
          // shape has moved between Live model versions.
          const audio = message.data;
          if (audio) {
            if (liveSession?.hasPendingStudentSpeech()) liveSession.flushStudentTurn();
            params.onExaminerAudio(Buffer.from(audio, 'base64'));
          }

          if (content.turnComplete) {
            liveSession?.flushExaminerTurn();
            params.onTurnComplete();
          }
        },
        onerror: (e: ErrorEvent) => params.onError(new Error(e.message)),
        onclose: () => {},
      },
    });

    liveSession = new GeminiLiveSession(session, params);

    // Parts 2 & 3 open with the examiner asking the first question.
    if (params.phase !== 'PART1') {
      liveSession.promptNextQuestion(params.timeRemainingMs);
    }

    return liveSession;
  }

  async scoreSession(input: ScoreSessionInput): Promise<ScoreSessionResult> {
    const prompt = buildScoringPrompt(input);
    const response = await this.ai.models.generateContent({
      model: env.GEMINI_SCORING_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: scoringResponseJsonSchema as never,
      },
    });

    const text = response.text;
    if (!text) throw new Error('Gemini returned an empty scoring response');

    const parsed = scoringResponseSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      throw new Error(`Scoring response failed validation: ${parsed.error.message}`);
    }
    const d = parsed.data;
    return {
      criterionA: d.criterionA,
      criterionB1: d.criterionB1,
      criterionB2: d.criterionB2,
      criterionC: d.criterionC,
      strengths: d.strengths as [string, string, string],
      priorities: d.priorities as [string, string, string],
      drills: d.drills,
      uncertaintyNote: d.uncertaintyNote,
    };
  }
}
