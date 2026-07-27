import type { FastifyPluginAsync } from 'fastify';
import {
  requestPasswordResetSchema,
  resetPasswordSchema,
  signInRequestSchema,
  signUpRequestSchema,
  verifyEmailRequestSchema,
} from '@morrai/shared';
import { authTokenRepo, userRepo, AUTH_TOKEN_PURPOSES, type AuthTokenPurpose } from '../db/repositories/index.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { generateOpaqueToken, hashToken } from '../auth/tokens.js';
import { createSession, revokeAllSessionsForUser, revokeSession } from '../auth/session.js';
import { clearSessionCookie, setSessionCookie } from '../auth/plugin.js';
import { requireAuth } from '../auth/requireAuth.js';
import { sessionMeta } from '../auth/requestMeta.js';
import { getEmailService } from '../email/index.js';
import { env } from '../config/env.js';
import { toCurrentUserDto } from './mappers.js';
import { SESSION_COOKIE_NAME } from '../auth/session.js';

const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

async function issueToken(userId: string, purpose: AuthTokenPurpose, ttlMs: number): Promise<string> {
  await authTokenRepo.invalidatePendingForUser(userId, purpose);
  const { token, tokenHash } = generateOpaqueToken();
  await authTokenRepo.create({ userId, tokenHash, purpose, expiresAt: new Date(Date.now() + ttlMs) });
  return token;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/auth/signup', async (req, reply) => {
    const parsed = signUpRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { email, password, displayName } = parsed.data;

    const normalizedEmail = email.trim().toLowerCase();
    if (await userRepo.findByEmail(normalizedEmail)) {
      return reply.code(409).send({ error: 'An account with this email already exists' });
    }

    // A guest (started a session without an account — req.currentUser is set
    // but has no email) who signs up keeps their existing id, upgraded in
    // place, so any session they already started stays attached to them
    // instead of being orphaned under a discarded guest row.
    const guest = req.currentUser && !req.currentUser.email ? req.currentUser : null;
    const user = guest
      ? await userRepo.upgradeGuestToAccount(guest.id, normalizedEmail, hashPassword(password), displayName)
      : await userRepo.createWithPassword(normalizedEmail, hashPassword(password), displayName);

    const verifyToken = await issueToken(user.id, AUTH_TOKEN_PURPOSES.EMAIL_VERIFY, EMAIL_VERIFY_TTL_MS);
    const verifyUrl = `${env.APP_BASE_URL}/verify-email?token=${encodeURIComponent(verifyToken)}`;
    await getEmailService()
      .sendVerificationEmail(normalizedEmail, verifyUrl)
      .catch((err) => req.log.error({ err }, 'failed to send verification email'));

    const { token } = await createSession(user.id, sessionMeta(req));
    setSessionCookie(reply, token);
    return reply.code(201).send({
      user: toCurrentUserDto({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
      }),
    });
  });

  app.post('/api/auth/signin', async (req, reply) => {
    const parsed = signInRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { email, password } = parsed.data;

    // Deliberately the same error for "no such email" and "wrong password" —
    // this is the one endpoint where telling them apart would help an
    // attacker enumerate accounts.
    const invalid = () => reply.code(401).send({ error: 'Invalid email or password' });

    const user = await userRepo.findByEmail(email.trim().toLowerCase());
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return invalid();
    }

    // Folds a just-started guest session into the account being signed into,
    // so a "try it before you sign up" interview isn't lost the moment they
    // log in to an existing account (as opposed to creating a new one, where
    // upgradeGuestToAccount above handles it instead).
    const guest = req.currentUser && !req.currentUser.email ? req.currentUser : null;
    if (guest && guest.id !== user.id) {
      await userRepo.mergeGuestInto(guest.id, user.id);
    }

    const { token } = await createSession(user.id, sessionMeta(req));
    setSessionCookie(reply, token);
    return reply.send({
      user: toCurrentUserDto({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
      }),
    });
  });

  app.post('/api/auth/signout', { preHandler: requireAuth }, async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE_NAME];
    if (token) await revokeSession(token);
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  app.get('/api/auth/me', async (req, reply) => {
    return reply.send({ user: req.currentUser ? toCurrentUserDto(req.currentUser) : null });
  });

  app.post('/api/auth/verify-email', async (req, reply) => {
    const parsed = verifyEmailRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const record = await authTokenRepo.findValid(hashToken(parsed.data.token), AUTH_TOKEN_PURPOSES.EMAIL_VERIFY);
    if (!record) return reply.code(400).send({ error: 'Invalid or expired link' });

    await authTokenRepo.markUsed(record.id);
    await userRepo.markEmailVerified(record.userId);
    return reply.send({ ok: true });
  });

  app.post('/api/auth/resend-verification', { preHandler: requireAuth }, async (req, reply) => {
    const user = req.currentUser!;
    if (user.emailVerifiedAt) return reply.send({ ok: true });
    if (!user.email) return reply.code(400).send({ error: 'No email on this account' });

    const verifyToken = await issueToken(user.id, AUTH_TOKEN_PURPOSES.EMAIL_VERIFY, EMAIL_VERIFY_TTL_MS);
    const verifyUrl = `${env.APP_BASE_URL}/verify-email?token=${encodeURIComponent(verifyToken)}`;
    await getEmailService().sendVerificationEmail(user.email, verifyUrl);
    return reply.send({ ok: true });
  });

  app.post('/api/auth/request-password-reset', async (req, reply) => {
    const parsed = requestPasswordResetSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const user = await userRepo.findByEmail(parsed.data.email.trim().toLowerCase());
    // Always 202 regardless of whether the email exists — no reason to leak
    // account existence on this endpoint.
    if (user && user.email) {
      const resetToken = await issueToken(user.id, AUTH_TOKEN_PURPOSES.PASSWORD_RESET, PASSWORD_RESET_TTL_MS);
      const resetUrl = `${env.APP_BASE_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;
      await getEmailService()
        .sendPasswordResetEmail(user.email, resetUrl)
        .catch((err) => req.log.error({ err }, 'failed to send password reset email'));
    }
    return reply.code(202).send({ ok: true });
  });

  app.post('/api/auth/reset-password', async (req, reply) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const record = await authTokenRepo.findValid(hashToken(parsed.data.token), AUTH_TOKEN_PURPOSES.PASSWORD_RESET);
    if (!record) return reply.code(400).send({ error: 'Invalid or expired link' });

    await authTokenRepo.markUsed(record.id);
    await userRepo.updatePassword(record.userId, hashPassword(parsed.data.newPassword));
    // A reset plausibly means a compromised session — kill every existing one.
    await revokeAllSessionsForUser(record.userId);

    const { token } = await createSession(record.userId, sessionMeta(req));
    setSessionCookie(reply, token);

    const user = await userRepo.findById(record.userId);
    return reply.send({
      user: user
        ? toCurrentUserDto({
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            emailVerifiedAt: user.emailVerifiedAt,
            createdAt: user.createdAt,
          })
        : null,
    });
  });
};
