import type { EmailService } from './EmailService.js';

/**
 * Used whenever no email provider is configured. Prints the link instead of
 * sending it, so signup/verification/reset are fully exercisable in local dev
 * and in tests without a real provider account.
 */
export class ConsoleEmailService implements EmailService {
  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    console.log(`[dev email] Verify ${to}: ${verifyUrl}`);
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    console.log(`[dev email] Reset password for ${to}: ${resetUrl}`);
  }
}
