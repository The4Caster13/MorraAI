import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResendEmailService } from './ResendEmailService.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ResendEmailService', () => {
  it('POSTs the expected request to Resend for a verification email', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new ResendEmailService('test-key', 'Morra AI <no-reply@example.com>');
    await service.sendVerificationEmail('student@example.com', 'https://app.example/verify?token=abc');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    const body = JSON.parse(init.body as string);
    expect(body.from).toBe('Morra AI <no-reply@example.com>');
    expect(body.to).toBe('student@example.com');
    expect(body.html).toContain('https://app.example/verify?token=abc');
  });

  it('throws with the response detail when Resend rejects the request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('invalid api key', { status: 401, statusText: 'Unauthorized' })),
    );
    const service = new ResendEmailService('bad-key', 'Morra AI <no-reply@example.com>');
    await expect(service.sendPasswordResetEmail('student@example.com', 'https://app.example/reset')).rejects.toThrow(
      /401/,
    );
  });
});
