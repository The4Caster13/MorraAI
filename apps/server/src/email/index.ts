import { emailMode, env } from '../config/env.js';
import { ConsoleEmailService } from './ConsoleEmailService.js';
import type { EmailService } from './EmailService.js';
import { ResendEmailService } from './ResendEmailService.js';

export type { EmailService } from './EmailService.js';

let instance: EmailService | null = null;

export function getEmailService(): EmailService {
  if (instance) return instance;
  if (emailMode() === 'resend') {
    if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is required when EMAIL_MODE=resend');
    instance = new ResendEmailService(env.RESEND_API_KEY, env.EMAIL_FROM);
  } else {
    instance = new ConsoleEmailService();
  }
  return instance;
}

/** Test seam — lets suites swap in a fake implementation. */
export function setEmailService(service: EmailService): void {
  instance = service;
}
