import type { Prisma } from '@prisma/client';
import { prisma } from '../client.js';

export const scoreRepo = {
  create(data: {
    sessionId: string;
    criterionA: number;
    criterionB1: number;
    criterionB2: number;
    criterionC: number;
    total: number;
    rationaleJson: Prisma.InputJsonValue;
    strengthsJson: Prisma.InputJsonValue;
    prioritiesJson: Prisma.InputJsonValue;
    drillsJson: Prisma.InputJsonValue;
    confidenceNote?: string | null;
  }) {
    return prisma.score.create({ data });
  },
  findBySession(sessionId: string) {
    return prisma.score.findUnique({ where: { sessionId } });
  },
};
