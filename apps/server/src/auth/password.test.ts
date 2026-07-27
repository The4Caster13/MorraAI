import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('hashPassword / verifyPassword', () => {
  it('round-trips the correct password', () => {
    const stored = hashPassword('correct horse battery staple');
    expect(verifyPassword('correct horse battery staple', stored)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const stored = hashPassword('correct horse battery staple');
    expect(verifyPassword('wrong password', stored)).toBe(false);
  });

  it('salts each hash differently, even for the same password', () => {
    const a = hashPassword('same password');
    const b = hashPassword('same password');
    expect(a).not.toBe(b);
    expect(verifyPassword('same password', a)).toBe(true);
    expect(verifyPassword('same password', b)).toBe(true);
  });

  it('rejects a malformed stored value without throwing', () => {
    expect(verifyPassword('anything', 'not-a-valid-format')).toBe(false);
    expect(verifyPassword('anything', '')).toBe(false);
  });
});
