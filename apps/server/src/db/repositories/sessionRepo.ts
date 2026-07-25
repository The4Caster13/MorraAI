import type { Prisma } from '@prisma/client';
import { prisma } from '../client.js';

export const sessionRepo = {
  create(data: {
    userId: string;
    stimulusId: string;
    mode: string;
    prepSecondsAllotted: number;
  }) {
    return prisma.session.create({ data, include: { stimulus: true } });
  },
  findById(id: string) {
    return prisma.session.findUnique({
      where: { id },
      include: { stimulus: true, score: true, consent: true },
    });
  },
  listByUser(userId: string) {
    return prisma.session.findMany({
      where: { userId },
      include: { stimulus: true, score: true },
      orderBy: { createdAt: 'desc' },
    });
  },
  update(id: string, data: Prisma.SessionUpdateInput) {
    return prisma.session.update({ where: { id }, data, include: { stimulus: true } });
  },
  delete(id: string) {
    return prisma.session.delete({ where: { id } });
  },
  recordConsent(data: {
    sessionId: string;
    userId: string;
    consentTextVersion: string;
    recordingConsent: boolean;
    dataRetentionAcknowledged: boolean;
  }) {
    return prisma.consentRecord.create({ data });
  },
  markStaleActiveSessionsErrored() {
    return prisma.session.updateMany({
      where: {
        status: {
          notIn: ['DRAFT', 'COMPLETE', 'ABANDONED', 'ERROR'],
        },
      },
      data: { status: 'ERROR' },
    });
  },
};
