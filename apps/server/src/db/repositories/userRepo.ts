import { prisma } from '../client.js';

export const userRepo = {
  upsert(id: string, displayName: string) {
    return prisma.user.upsert({
      where: { id },
      update: { displayName },
      create: { id, displayName },
    });
  },
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },
};
