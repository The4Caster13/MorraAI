import { describe, expect, it } from 'vitest';

// Mirrors the PLACEHOLDER pattern in env.ts. Kept in a test so the IPv6 cases
// below are checked explicitly rather than assumed.
const PLACEHOLDER = /<[^>]*>|\[[A-Za-z][A-Za-z_-]*\]/;

const hasPlaceholder = (url: string) => PLACEHOLDER.test(url);

describe('connection string placeholder detection', () => {
  it('catches an unreplaced Supabase password', () => {
    expect(
      hasPlaceholder(
        'postgresql://postgres.abcdefghij:[YOUR-PASSWORD]@aws-1-ca-central-1.pooler.supabase.com:5432/postgres',
      ),
    ).toBe(true);
  });

  it('catches an unreplaced angle-bracket template', () => {
    expect(hasPlaceholder('postgresql://postgres.<ref>:pw@host:5432/postgres')).toBe(true);
  });

  it('accepts a fully filled connection string', () => {
    expect(
      hasPlaceholder(
        'postgresql://postgres.abcdefghij:s3cretPassw0rd@aws-1-ca-central-1.pooler.supabase.com:5432/postgres',
      ),
    ).toBe(false);
  });

  it('does not mistake a bracketed IPv6 host for a placeholder', () => {
    expect(hasPlaceholder('postgresql://postgres:pw@[::1]:5432/postgres')).toBe(false);
    expect(hasPlaceholder('postgresql://postgres:pw@[fe80::1]:5432/postgres')).toBe(false);
    expect(hasPlaceholder('postgresql://postgres:pw@[2001:db8::8a2e:370:7334]:5432/postgres')).toBe(
      false,
    );
  });

  it('accepts a password containing percent-encoded characters', () => {
    expect(hasPlaceholder('postgresql://postgres:p%40ssword@host:5432/postgres')).toBe(false);
  });
});
