import type { EmailService } from './EmailService.js';

const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Sends via Resend's HTTP API directly (plain `fetch`, no SDK) — one less
 * dependency, and this app already avoids native-binary packages after an
 * earlier cross-platform build break, so a bare HTTP call is the simpler
 * choice here too.
 *
 * NOTE: without a verified sending domain, Resend's sandbox mode only
 * delivers to the account's own registered email — real students won't
 * receive anything until a domain is verified and `EMAIL_FROM` points at it.
 */
export class ResendEmailService implements EmailService {
  constructor(
    private apiKey: string,
    private from: string,
  ) {}

  private async send(to: string, subject: string, html: string): Promise<void> {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Resend send failed (${res.status}): ${body || res.statusText}`);
    }
  }

  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    await this.send(
      to,
      'Verify your Morra AI email',
      `<p>Welcome to Morra AI. Confirm your email to finish setting up your account:</p>` +
        `<p><a href="${verifyUrl}">${verifyUrl}</a></p>` +
        `<p>If you didn't create this account, you can ignore this email.</p>`,
    );
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.send(
      to,
      'Reset your Morra AI password',
      `<p>Someone requested a password reset for this account.</p>` +
        `<p><a href="${resetUrl}">${resetUrl}</a></p>` +
        `<p>If it wasn't you, you can safely ignore this email — your password won't change.</p>`,
    );
  }
}
