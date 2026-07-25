import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * `requireAccessCode` reads the frozen env object, so each case re-imports the
 * module with a different ACCESS_CODE rather than mutating shared state.
 */
async function guardWith(accessCode: string | undefined) {
  vi.resetModules();
  if (accessCode === undefined) delete process.env.ACCESS_CODE;
  else process.env.ACCESS_CODE = accessCode;
  const mod = await import('./accessCode.js');
  return mod;
}

function fakeReply() {
  const reply = {
    statusCode: 0 as number,
    payload: undefined as unknown,
    code(status: number) {
      reply.statusCode = status;
      return reply;
    },
    send(body: unknown) {
      reply.payload = body;
      return reply;
    },
  };
  return reply;
}

const req = (code?: string) =>
  ({ headers: code === undefined ? {} : { 'x-access-code': code } }) as never;

const original = process.env.ACCESS_CODE;
beforeEach(() => vi.resetModules());
afterEach(() => {
  if (original === undefined) delete process.env.ACCESS_CODE;
  else process.env.ACCESS_CODE = original;
});

describe('requireAccessCode', () => {
  it('lets everything through when no code is configured', async () => {
    const { requireAccessCode } = await guardWith(undefined);
    const reply = fakeReply();
    await requireAccessCode(req(), reply as never);
    expect(reply.statusCode).toBe(0); // never touched
  });

  it('accepts the correct code', async () => {
    const { requireAccessCode } = await guardWith('open-sesame');
    const reply = fakeReply();
    await requireAccessCode(req('open-sesame'), reply as never);
    expect(reply.statusCode).toBe(0);
  });

  it('rejects a wrong code with a marker the client can branch on', async () => {
    const { requireAccessCode, ACCESS_CODE_REQUIRED } = await guardWith('open-sesame');
    const reply = fakeReply();
    await requireAccessCode(req('guess'), reply as never);
    expect(reply.statusCode).toBe(401);
    expect((reply.payload as { code: string }).code).toBe(ACCESS_CODE_REQUIRED);
  });

  it('rejects a missing header', async () => {
    const { requireAccessCode } = await guardWith('open-sesame');
    const reply = fakeReply();
    await requireAccessCode(req(), reply as never);
    expect(reply.statusCode).toBe(401);
  });

  it('rejects a code of the wrong length without throwing', async () => {
    // timingSafeEqual throws on length mismatch if not guarded first.
    const { requireAccessCode } = await guardWith('open-sesame');
    for (const attempt of ['', 'x', 'open-sesame-longer']) {
      const reply = fakeReply();
      await expect(requireAccessCode(req(attempt), reply as never)).resolves.not.toThrow();
      expect(reply.statusCode).toBe(401);
    }
  });

  it('is not fooled by a prefix of the real code', async () => {
    const { requireAccessCode } = await guardWith('open-sesame');
    const reply = fakeReply();
    await requireAccessCode(req('open'), reply as never);
    expect(reply.statusCode).toBe(401);
  });
});
