import { prisma } from '../client.js';

export const stimulusRepo = {
  list(theme?: string) {
    return prisma.stimulus.findMany({
      where: theme ? { theme } : undefined,
      orderBy: { id: 'asc' },
    });
  },
  findById(id: string) {
    return prisma.stimulus.findUnique({ where: { id } });
  },
  async pickRandom(theme?: string) {
    const all = await prisma.stimulus.findMany({
      where: theme ? { theme } : undefined,
      select: { id: true },
    });
    if (all.length === 0) return null;
    const pick = all[Math.floor(Math.random() * all.length)];
    return prisma.stimulus.findUnique({ where: { id: pick.id } });
  },
};
