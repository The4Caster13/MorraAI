import { prisma } from '../client.js';

export const transcriptRepo = {
  add(data: {
    sessionId: string;
    phase: string;
    speaker: string;
    text: string;
    startMs: number;
    endMs: number;
    sttConfidence?: number | null;
  }) {
    return prisma.transcriptSegment.create({ data });
  },
  listBySession(sessionId: string) {
    return prisma.transcriptSegment.findMany({
      where: { sessionId },
      orderBy: { startMs: 'asc' },
    });
  },
  addAudioFile(data: {
    sessionId: string;
    phase: string;
    speaker: string;
    filePath: string;
    durationMs: number;
  }) {
    return prisma.audioFile.upsert({
      where: {
        sessionId_phase_speaker: {
          sessionId: data.sessionId,
          phase: data.phase,
          speaker: data.speaker,
        },
      },
      update: { filePath: data.filePath, durationMs: data.durationMs },
      create: data,
    });
  },
  findAudioFile(sessionId: string, phase: string, speaker: string) {
    return prisma.audioFile.findUnique({
      where: { sessionId_phase_speaker: { sessionId, phase, speaker } },
    });
  },
};
