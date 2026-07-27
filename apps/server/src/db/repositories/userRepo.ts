import { prisma } from '../client.js';

export const userRepo = {
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
  createWithPassword(email: string, passwordHash: string, displayName: string) {
    return prisma.user.create({ data: { email, passwordHash, displayName } });
  },
  /** A no-email, no-password row backing a "try it without an account" session. */
  createGuest() {
    return prisma.user.create({ data: { displayName: 'Guest' } });
  },
  /** Upgrades an existing guest row in place — same id, so its sessions carry over untouched. */
  upgradeGuestToAccount(id: string, email: string, passwordHash: string, displayName: string) {
    return prisma.user.update({ where: { id }, data: { email, passwordHash, displayName } });
  },
  markEmailVerified(id: string) {
    return prisma.user.update({ where: { id }, data: { emailVerifiedAt: new Date() } });
  },
  updatePassword(id: string, passwordHash: string) {
    return prisma.user.update({ where: { id }, data: { passwordHash } });
  },
  /**
   * Folds a guest's sessions/consents into a real account the person just
   * signed into, then discards the now-empty guest row. Reassigning the FKs
   * before deleting is what makes the delete safe — Session/ConsentRecord
   * have no cascade from User, so a guest row with rows still pointing at it
   * cannot be deleted.
   */
  async mergeGuestInto(guestId: string, targetUserId: string): Promise<void> {
    await prisma.$transaction([
      prisma.session.updateMany({ where: { userId: guestId }, data: { userId: targetUserId } }),
      prisma.consentRecord.updateMany({ where: { userId: guestId }, data: { userId: targetUserId } }),
      prisma.user.delete({ where: { id: guestId } }),
    ]);
  },
};
