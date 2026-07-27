import { prisma } from '../client.js';

export const AUTH_TOKEN_PURPOSES = {
  EMAIL_VERIFY: 'EMAIL_VERIFY',
  PASSWORD_RESET: 'PASSWORD_RESET',
} as const;
export type AuthTokenPurpose = (typeof AUTH_TOKEN_PURPOSES)[keyof typeof AUTH_TOKEN_PURPOSES];

export const authTokenRepo = {
  create(input: { userId: string; tokenHash: string; purpose: AuthTokenPurpose; expiresAt: Date }) {
    return prisma.authToken.create({ data: input });
  },
  /** A token is usable only if it matches the expected purpose, is unused, and unexpired. */
  findValid(tokenHash: string, purpose: AuthTokenPurpose) {
    return prisma.authToken.findFirst({
      where: { tokenHash, purpose, usedAt: null, expiresAt: { gt: new Date() } },
    });
  },
  markUsed(id: string) {
    return prisma.authToken.update({ where: { id }, data: { usedAt: new Date() } });
  },
  /** Called before issuing a fresh token, so an older email link stops working. */
  invalidatePendingForUser(userId: string, purpose: AuthTokenPurpose) {
    return prisma.authToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });
  },
};
