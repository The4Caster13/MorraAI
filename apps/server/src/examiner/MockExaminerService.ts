import type {
  ExaminerService,
  LiveExaminerSession,
  OpenLiveSessionParams,
  ScoreSessionInput,
  ScoreSessionResult,
} from './ExaminerService.js';

const PART2_QUESTIONS = [
  'Merci pour votre présentation. Pouvez-vous décrire plus en détail ce que vous voyez sur cette image ?',
  'Pourquoi pensez-vous que ce thème est important pour les jeunes francophones ?',
  "Quel lien voyez-vous entre cette image et votre propre expérience ?",
  'Comment cette situation est-elle différente dans votre pays ?',
  "Qu'est-ce qui vous a le plus marqué dans cette image, et pourquoi ?",
];

const PART3_QUESTIONS = [
  "Parlons maintenant d'un autre sujet. Quel rôle la technologie joue-t-elle dans votre vie quotidienne ?",
  "Pensez-vous que les jeunes d'aujourd'hui s'engagent assez pour l'environnement ?",
  'Comment décririez-vous votre identité culturelle ?',
  "Quelle expérience de voyage vous a le plus transformé ?",
  "À votre avis, comment la vie de famille va-t-elle évoluer à l'avenir ?",
];

const REPHRASE_PREFIX = 'Bien sûr, je reformule : ';
const CLOSING_LINE = 'Merci beaucoup. Nous allons maintenant passer à la suite.';

// 300ms of silence at 24kHz mono PCM16 — keeps the client playback pipeline exercised.
const SILENT_CHUNK = Buffer.alloc(24000 * 2 * 0.3);

class MockLiveSession implements LiveExaminerSession {
  private questionIndex = 0;
  private lastQuestion: string | null = null;
  private closed = false;
  private pendingTimer: NodeJS.Timeout | null = null;

  constructor(private params: OpenLiveSessionParams) {}

  start() {
    if (this.params.phase !== 'PART1') {
      this.askNext(600);
    }
  }

  private questions(): string[] {
    return this.params.phase === 'PART3' ? PART3_QUESTIONS : PART2_QUESTIONS;
  }

  private askNext(delayMs: number, prefix = '') {
    if (this.closed) return;
    const qs = this.questions();
    const q = qs[this.questionIndex % qs.length];
    this.questionIndex += 1;
    this.lastQuestion = q;
    this.speak(prefix + q, delayMs);
  }

  private speak(text: string, delayMs: number) {
    if (this.pendingTimer) clearTimeout(this.pendingTimer);
    this.pendingTimer = setTimeout(() => {
      if (this.closed) return;
      this.params.onExaminerQuestionText(text);
      this.params.onExaminerAudio(SILENT_CHUNK);
      this.params.onTurnComplete();
    }, delayMs);
  }

  sendStudentAudioChunk(_pcm16: Buffer): void {
    // Mock mode has no STT; audio is accepted and ignored.
  }

  sendStudentText(text: string): void {
    if (this.closed) return;
    this.params.onStudentTranscript({ text, isFinal: true, confidence: 1 });
    if (this.params.phase !== 'PART1') {
      this.askNext(800);
    }
  }

  requestRephrase(): void {
    if (this.closed || !this.lastQuestion) return;
    this.speak(REPHRASE_PREFIX + this.lastQuestion, 500);
  }

  requestClosing(): void {
    this.speak(CLOSING_LINE, 300);
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.pendingTimer) clearTimeout(this.pendingTimer);
  }
}

export class MockExaminerService implements ExaminerService {
  async openLiveSession(params: OpenLiveSessionParams): Promise<LiveExaminerSession> {
    const session = new MockLiveSession(params);
    session.start();
    return session;
  }

  async scoreSession(input: ScoreSessionInput): Promise<ScoreSessionResult> {
    const studentSegments = input.fullTranscript.filter((s) => s.speaker === 'STUDENT');
    const firstQuote = studentSegments[0]?.text ?? '(aucune transcription disponible)';
    const midQuote = studentSegments[Math.floor(studentSegments.length / 2)]?.text ?? firstQuote;
    const note =
      studentSegments.length < 3
        ? "Très peu de contenu étudiant a été transcrit pendant cette session ; ces notes fictives ne reflètent pas une vraie performance."
        : 'Score fictif généré en mode mock (sans IA). Ajoutez une clé GEMINI_API_KEY pour une évaluation réelle.';
    return {
      criterionA: {
        mark: 8,
        band: 'Proficient',
        justification: `Évaluation fictive (mode mock). Exemple cité : « ${firstQuote} »`,
        evidenceQuotes: [firstQuote],
      },
      criterionB1: {
        mark: 4,
        band: 'Proficient',
        justification: `Évaluation fictive (mode mock). Exemple cité : « ${midQuote} »`,
        evidenceQuotes: [midQuote],
      },
      criterionB2: {
        mark: 4,
        band: 'Proficient',
        justification: `Évaluation fictive (mode mock). Exemple cité : « ${midQuote} »`,
        evidenceQuotes: [midQuote],
      },
      criterionC: {
        mark: 4,
        band: 'Proficient',
        justification: `Évaluation fictive (mode mock). Exemple cité : « ${firstQuote} »`,
        evidenceQuotes: [firstQuote],
      },
      strengths: [
        'Vous avez terminé la session complète — la régularité est la clé du progrès.',
        'Vous avez répondu aux questions dans les temps impartis.',
        'Vous avez maintenu l’interaction pendant toutes les phases.',
      ],
      priorities: [
        'Ajoutez une clé API Gemini pour obtenir une évaluation réelle de votre français.',
        'Entraînez-vous à développer vos réponses avec des exemples concrets.',
        'Travaillez la variété des temps verbaux (passé composé, imparfait, conditionnel).',
      ],
      drills: [
        'Décrivez une image pendant 4 minutes sans interruption.',
        'Enregistrez-vous en répondant à des questions hypothétiques au conditionnel.',
      ],
      uncertaintyNote: note,
    };
  }
}
