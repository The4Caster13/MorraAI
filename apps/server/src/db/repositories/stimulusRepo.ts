import { prisma } from '../client.js';

export const stimulusRepo = {
  list(theme?: string) {
    return prisma.stimulus.findMany({
      where: { retired: false, ...(theme ? { theme } : {}) },
      orderBy: { id: 'asc' },
    });
  },
  findById(id: string) {
    return prisma.stimulus.findUnique({ where: { id } });
  },
  async pickRandom(theme?: string) {
    // Theme narrows the pool for practice mode; a random one comes from the
    // full active pool when no theme is given, matching how the real exam
    // assigns a stimulus the student doesn't choose. Retired rows — kept only
    // for old sessions whose image files may no longer exist — are always
    // excluded from both.
    const all = await prisma.stimulus.findMany({
      where: { retired: false, ...(theme ? { theme } : {}) },
      select: { id: true },
    });
    if (all.length === 0) return null;
    const pick = all[Math.floor(Math.random() * all.length)];
    return prisma.stimulus.findUnique({ where: { id: pick.id } });
  },
};
