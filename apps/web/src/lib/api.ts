import type {
  ConsentRequest,
  CreateSessionRequest,
  ScoreDto,
  SessionDto,
  SessionSummaryDto,
  StimulusDto,
  TranscriptSegmentDto,
} from '@parlons/shared';

/**
 * Builds a readable message from a failed response.
 *
 * The body is whatever the server managed to produce: our own `{error, hint}`
 * JSON, an HTML error page from the Vite proxy when the backend is down, or
 * nothing at all. Parsing is therefore best-effort — a body that isn't JSON is
 * information about what went wrong, not a reason to throw a parser error over
 * the top of the real one.
 */
export function describeHttpError(status: number, statusText: string, body: string): string {
  let detail = body.trim();
  let hint: string | undefined;

  if (detail.startsWith('{')) {
    try {
      const parsed = JSON.parse(detail) as { error?: unknown; hint?: unknown };
      if (typeof parsed.error === 'string' && parsed.error) detail = parsed.error;
      if (typeof parsed.hint === 'string' && parsed.hint) hint = parsed.hint;
    } catch {
      // Malformed JSON — fall through and show the raw body.
    }
  }

  const base = detail ? `${status}: ${detail}` : `${status} ${statusText || 'Request failed'}`;
  return hint ? `${base}\n\n${hint}` : base;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });

  if (!res.ok) {
    throw new Error(describeHttpError(res.status, res.statusText, await res.text()));
  }

  if (res.status === 204) return undefined as T;

  // A 2xx with an empty or non-JSON body means something between us and the
  // route handler answered instead — say so rather than surfacing a parse error.
  const body = await res.text();
  if (!body.trim()) return undefined as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(
      `${res.status} but the response was not JSON. Is the API reachable?\n\n${body.slice(0, 200)}`,
    );
  }
}

export const api = {
  createUser(id: string, displayName: string) {
    return request<{ id: string; displayName: string }>('/api/users', {
      method: 'POST',
      body: JSON.stringify({ id, displayName }),
    });
  },
  listStimuli(theme?: string) {
    const q = theme ? `?theme=${encodeURIComponent(theme)}` : '';
    return request<StimulusDto[]>(`/api/stimuli${q}`);
  },
  createSession(body: CreateSessionRequest) {
    return request<SessionDto>('/api/sessions', { method: 'POST', body: JSON.stringify(body) });
  },
  consent(sessionId: string, body: ConsentRequest) {
    return request<SessionDto>(`/api/sessions/${sessionId}/consent`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  getSession(sessionId: string, userId: string) {
    return request<SessionDto & { score: ScoreDto | null }>(
      `/api/sessions/${sessionId}?userId=${encodeURIComponent(userId)}`,
    );
  },
  getTranscript(sessionId: string, userId: string) {
    return request<TranscriptSegmentDto[]>(
      `/api/sessions/${sessionId}/transcript?userId=${encodeURIComponent(userId)}`,
    );
  },
  listSessions(userId: string) {
    return request<SessionSummaryDto[]>(`/api/sessions?userId=${encodeURIComponent(userId)}`);
  },
  deleteSession(sessionId: string, userId: string) {
    return request<void>(`/api/sessions/${sessionId}?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
  },
};
