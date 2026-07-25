import type { SessionMode, TranscriptSegmentDto } from '@parlons/shared';
import type { ExaminerService, StimulusContext } from '../examiner/ExaminerService.js';
import { scoreRepo, transcriptRepo } from '../db/repositories/index.js';

export async function scoreAndPersist(
  sessionId: string,
  stimulus: StimulusContext,
  mode: SessionMode,
  examiner: ExaminerService,
  _meta: { lowConfidenceSegments: number },
) {
  const segments = await transcriptRepo.listBySession(sessionId);
  const fullTranscript: TranscriptSegmentDto[] = segments.map((s) => ({
    id: s.id,
    phase: s.phase as TranscriptSegmentDto['phase'],
    speaker: s.speaker as TranscriptSegmentDto['speaker'],
    text: s.text,
    startMs: s.startMs,
    endMs: s.endMs,
    sttConfidence: s.sttConfidence,
  }));

  const confidences = fullTranscript
    .map((s) => s.sttConfidence)
    .filter((c): c is number => c !== null);
  const avg =
    confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null;
  const lowConfidenceSegmentIds = fullTranscript
    .filter((s) => s.sttConfidence !== null && s.sttConfidence < 0.6)
    .map((s) => s.id);

  const result = await examiner.scoreSession({
    fullTranscript,
    stimulus,
    mode,
    sttConfidenceSummary: { avg, lowConfidenceSegmentIds },
  });

  // Never trust the model's arithmetic — recompute the total server-side.
  const total =
    result.criterionA.mark +
    result.criterionB1.mark +
    result.criterionB2.mark +
    result.criterionC.mark;

  return scoreRepo.create({
    sessionId,
    criterionA: result.criterionA.mark,
    criterionB1: result.criterionB1.mark,
    criterionB2: result.criterionB2.mark,
    criterionC: result.criterionC.mark,
    total,
    rationaleJson: {
      A: { ...result.criterionA },
      B1: { ...result.criterionB1 },
      B2: { ...result.criterionB2 },
      C: { ...result.criterionC },
    },
    strengthsJson: [...result.strengths],
    prioritiesJson: [...result.priorities],
    drillsJson: [...result.drills],
    confidenceNote: result.uncertaintyNote,
  });
}
