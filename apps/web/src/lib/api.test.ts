import { describe, expect, it } from 'vitest';
import { describeHttpError } from './api';

describe('describeHttpError', () => {
  it('uses the server error message and hint when both are present', () => {
    const msg = describeHttpError(
      500,
      'Internal Server Error',
      JSON.stringify({ error: 'Table does not exist', hint: 'Run: npm run db:deploy' }),
    );
    expect(msg).toContain('Table does not exist');
    expect(msg).toContain('Run: npm run db:deploy');
  });

  it('falls back to the status line when the body is empty', () => {
    // The regression: JSON.parse('') throws "Unexpected end of JSON input",
    // which used to be rethrown in place of the actual HTTP failure.
    expect(describeHttpError(502, 'Bad Gateway', '')).toBe('502 Bad Gateway');
  });

  it('shows a non-JSON body verbatim instead of a parser error', () => {
    const msg = describeHttpError(500, 'Internal Server Error', '<html>proxy error</html>');
    expect(msg).toContain('proxy error');
    expect(msg).not.toContain('JSON');
  });

  it('shows malformed JSON verbatim rather than throwing', () => {
    expect(() => describeHttpError(500, 'Internal Server Error', '{"error":')).not.toThrow();
    expect(describeHttpError(500, 'Internal Server Error', '{"error":')).toContain('{"error":');
  });

  it('handles JSON without the expected fields', () => {
    const msg = describeHttpError(400, 'Bad Request', JSON.stringify({ error: { fieldErrors: {} } }));
    expect(msg).toContain('400');
  });

  it('never produces a bare status with no text', () => {
    expect(describeHttpError(500, '', '')).toBe('500 Request failed');
  });
});
