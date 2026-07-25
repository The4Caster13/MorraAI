import { describe, expect, it } from 'vitest';
import { blankIfUnfilled } from './env.js';

describe('blankIfUnfilled', () => {
  it('treats an unfilled .env.example template as unset', () => {
    // The reported crash: this value failed .url() and took the server down at boot.
    expect(blankIfUnfilled('https://<project-ref>.supabase.co')).toBeUndefined();
    expect(blankIfUnfilled('<service-role-key>')).toBeUndefined();
  });

  it('treats blank and whitespace-only values as unset', () => {
    expect(blankIfUnfilled('')).toBeUndefined();
    expect(blankIfUnfilled('   ')).toBeUndefined();
  });

  it('keeps a real value, trimmed', () => {
    expect(blankIfUnfilled(' https://abc.supabase.co ')).toBe('https://abc.supabase.co');
  });

  it('passes non-strings through untouched', () => {
    expect(blankIfUnfilled(undefined)).toBeUndefined();
    expect(blankIfUnfilled(3001)).toBe(3001);
  });
});
