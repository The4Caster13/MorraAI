import { describe, expect, it, vi } from 'vitest';
import { ConsoleEmailService } from './ConsoleEmailService.js';

describe('ConsoleEmailService', () => {
  it('logs the verification link instead of sending it', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const service = new ConsoleEmailService();
    await service.sendVerificationEmail('student@example.com', 'https://app.example/verify?token=abc');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('student@example.com'));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('https://app.example/verify?token=abc'));
    spy.mockRestore();
  });

  it('logs the password reset link instead of sending it', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const service = new ConsoleEmailService();
    await service.sendPasswordResetEmail('student@example.com', 'https://app.example/reset?token=xyz');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('https://app.example/reset?token=xyz'));
    spy.mockRestore();
  });
});
