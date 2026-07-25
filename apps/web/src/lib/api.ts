import type {
  ConsentRequest,
  CreateSessionRequest,
  ScoreDto,
  SessionDto,
  SessionSummaryDto,
  StimulusDto,
  TranscriptSegmentDto,
} from '@parlons/shared';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
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
