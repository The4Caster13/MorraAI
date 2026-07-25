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

const PHASE_BRIEFS: Record<string, string> = {
  PART1:
    "L'étudiant présente le stimulus visuel pendant 3 à 4 minutes. Écoute sans interrompre. N'interviens que si on te le demande explicitement.",
  PART2:
    "Tu poses des questions sur la présentation et le stimulus. Chaque question doit reprendre quelque chose que l'étudiant vient de dire.",
  PART3:
    "Tu élargis la conversation à d'autres thèmes du programme, en gardant un lien avec les intérêts que l'étudiant a montrés.",
};

function systemInstruction(params: OpenLiveSessionParams): string {
  const est = params.competenceEstimate;
  const level =
    est === undefined
      ? 'inconnu'
      : est.A > 0.7
        ? 'fort'
        : est.A < 0.35
          ? 'fragile'
          : 'intermédiaire';
  const difficulty =
    level === 'fort'
      ? "Pose des questions abstraites, comparatives ou hypothétiques qui invitent au conditionnel et au subjonctif."
      : level === 'fragile'
        ? "Pose des questions courtes et concrètes, au présent, et reformule volontiers si l'étudiant hésite."
        : "Pose des questions claires mais qui invitent à développer, avec des exemples concrets.";

  return `Tu es un examinateur d'entraînement pour l'oral individuel de français B (niveau moyen).

RÈGLES ABSOLUES :
- Tu parles UNIQUEMENT en français, jamais en anglais, quelles que soient les circonstances.
- Tu ne corriges JAMAIS l'étudiant pendant la session et tu ne commentes jamais ses erreurs.
- Tes questions sont ouvertes et bienveillantes ; une seule question à la fois.
- Tu restes bref : une ou deux phrases maximum par tour de parole.
- Si l'étudiant demande une répétition, reformule plus simplement sans jamais traduire.

PHASE ACTUELLE : ${params.phase}. ${PHASE_BRIEFS[params.phase]}
NIVEAU ESTIMÉ DE L'ÉTUDIANT : ${level}. ${difficulty}

STIMULUS VISUEL : « ${params.stimulus.captionFr} » (thème : ${params.stimulus.theme}, sous-thème : ${params.stimulus.subtopic}).
Lien culturel : ${params.stimulus.culturalLinkFr}
${params.priorTranscript ? `\nCE QUE L'ÉTUDIANT A DÉJÀ DIT :\n${params.priorTranscript}` : ''}`;
}

class GeminiLiveSession implements LiveExaminerSession {
  private closed = false;

  constructor(
    private session: Session,
    private params: OpenLiveSessionParams,
  ) {}

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

  /** Nudges the examiner to ask its next question, with current timing/competence context. */
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
    this.closed = true;
    this.session.close();
  }
}

export class GeminiExaminerService implements ExaminerService {
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
          if (inputText) {
            params.onStudentTranscript({ text: inputText, isFinal: false, confidence: null });
          }

          const outputText = content.outputTranscription?.text;
          if (outputText) params.onExaminerQuestionText(outputText);

          for (const part of content.modelTurn?.parts ?? []) {
            const data = part.inlineData?.data;
            if (data) params.onExaminerAudio(Buffer.from(data, 'base64'));
          }

          if (content.turnComplete) {
            params.onTurnComplete();
            liveSession?.promptNextQuestion(params.timeRemainingMs);
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
