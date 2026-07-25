import { describe, expect, it } from 'vitest';
import { hintForError } from './errorHint.js';

function prismaError(code: string, message = 'boom') {
  return Object.assign(new Error(message), { code });
}

describe('hintForError', () => {
  it('spots an unreplaced placeholder before blaming credentials', () => {
    const err = new Error('FATAL: (ENOTFOUND) tenant/user postgres.<ref> not found');
    expect(hintForError(err)).toMatch(/placeholder/i);
  });

  it('explains a rejected Supabase username', () => {
    const err = new Error('FATAL: tenant or user not found');
    expect(hintForError(err)).toMatch(/project-ref|Session pooler/);
  });

  it('spots a connection pooler rejecting prepared statements', () => {
    const err = new Error('prepared statement "s0" already exists');
    expect(hintForError(err)).toMatch(/pgbouncer=true/);
  });

  it('tells you to migrate when a table is missing', () => {
    expect(hintForError(prismaError('P2021'))).toMatch(/db:deploy/);
  });

  it('tells you to seed when a foreign key has nothing to point at', () => {
    expect(hintForError(prismaError('P2003'))).toMatch(/db:seed/);
  });

  it('distinguishes an unreachable database from a wrong password', () => {
    expect(hintForError(prismaError('P1001'))).toMatch(/Cannot reach/);
    expect(hintForError(prismaError('P1000'))).toMatch(/Authentication failed/);
  });

  it('recognises an ungenerated client by name or message', () => {
    const byName = Object.assign(new Error('x'), { name: 'PrismaClientInitializationError' });
    expect(hintForError(byName)).toMatch(/db:generate|DATABASE_URL/);
    expect(hintForError(new Error('@prisma/client did not initialize yet'))).toMatch(/db:generate/);
  });

  it('stays quiet for ordinary application errors', () => {
    expect(hintForError(new Error('Not your session'))).toBeUndefined();
    expect(hintForError(prismaError('P9999'))).toBeUndefined();
  });

  it('does not throw on non-Error values', () => {
    expect(() => hintForError('a string')).not.toThrow();
    expect(() => hintForError(null)).not.toThrow();
  });
});
