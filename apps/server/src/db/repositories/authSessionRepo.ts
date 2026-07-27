import { prisma } from '../client.js';

export const authSessionRepo = {
  create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string | null;
    ipAddress?: string | null;
  }) {
    return prisma.authSession.create({ data: input });
  },
  findByTokenHash(tokenHash: string) {
    return prisma.authSession.findUnique({ where: { tokenHash }, include: { user: true } });
  },
  deleteByTokenHash(tokenHash: string) {
    return prisma.authSession.deleteMany({ where: { tokenHash } });
  },
  deleteAllForUser(userId: string) {
    return prisma.authSession.deleteMany({ where: { userId } });
  },
};
