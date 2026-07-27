import { describe, expect, it } from 'vitest';
import { generateOpaqueToken, hashToken } from './tokens.js';

describe('generateOpaqueToken / hashToken', () => {
  it('generates a unique token each call', () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });

  it('hashes deterministically', () => {
    const { token, tokenHash } = generateOpaqueToken();
    expect(hashToken(token)).toBe(tokenHash);
  });

  it('produces a hash that does not reveal the raw token', () => {
    const { token, tokenHash } = generateOpaqueToken();
    expect(tokenHash).not.toContain(token);
  });
});
