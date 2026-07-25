/**
 * Turns the most common infrastructure failures into a one-line instruction.
 *
 * These all surface identically to the browser — a bare 500 — even though the
 * fixes are completely different. Matching on the Prisma error code (or, where
 * there isn't one, the message) means the terminal says what to do rather than
 * just that something broke.
 */
export function hintForError(err: unknown): string | undefined {
  if (err === null || err === undefined) return undefined;
  const asRecord = typeof err === 'object' ? (err as { code?: string; name?: string }) : {};
  const code = asRecord.code;
  const name = asRecord.name;
  const message = err instanceof Error ? err.message : String(err);

  // Check for an unreplaced template before anything else — it otherwise
  // surfaces as an authentication or DNS failure and sends you hunting for the
  // wrong thing.
  if (/[<>]/.test(message)) {
    return 'A connection string still contains a <placeholder>. Replace every <...> in .env with the real value from your database provider.';
  }
  // Supabase's pooler reports an unknown username this way, which in practice
  // means the project ref is wrong or was never substituted in.
  if (message.includes('tenant or user not found') || message.includes('tenant/user')) {
    return 'The database rejected the username. On Supabase it must be postgres.<your-project-ref> with the ref substituted in — copy the string from Connect → Session pooler.';
  }
  // The host and username were accepted, so this is squarely the password.
  if (message.includes('Authentication failed') || message.includes('password authentication')) {
    return (
      'The database password is wrong. Three usual causes: [YOUR-PASSWORD] was never replaced; ' +
      'the password is genuinely different (Settings → Database → Reset database password); or it ' +
      'contains @ : / ? # or %, which must be percent-encoded inside a URL — resetting to letters ' +
      'and digits only avoids that entirely.'
    );
  }
  // Supavisor/PgBouncer in transaction mode (Supabase port 6543) cannot hold
  // prepared statements, which Prisma creates by default.
  if (message.includes('prepared statement')) {
    return 'DATABASE_URL points at a connection pooler. Append ?pgbouncer=true to it, or use the direct (port 5432) URL.';
  }

  switch (code) {
    case 'P1001':
      return 'Cannot reach the database. Check DATABASE_URL, and that the database is running and reachable from this network.';
    case 'P1002':
      return 'The database timed out. It may be paused — Supabase free projects sleep after a period of inactivity.';
    case 'P1000':
      return 'Authentication failed. The password in DATABASE_URL is wrong, or still the [YOUR-PASSWORD] placeholder.';
    case 'P2021':
      return 'That table does not exist. Run: npm run db:deploy --workspace=apps/server';
    case 'P2022':
      return 'A column is missing — the database is behind the schema. Run: npm run db:deploy --workspace=apps/server';
    case 'P2003':
      return 'Foreign key constraint failed — a referenced row is missing. If this is a stimulus, run: npm run db:seed --workspace=apps/server';
    default:
      break;
  }

  if (name === 'PrismaClientInitializationError') {
    return 'Prisma could not start. Usually DATABASE_URL is unset, or the client needs regenerating: npm run db:generate --workspace=apps/server';
  }
  if (message.includes('did not initialize yet')) {
    return 'The Prisma client has not been generated. Run: npm run db:generate --workspace=apps/server';
  }
  return undefined;
}
