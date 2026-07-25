const USER_ID_KEY = 'parlons.userId';
const USER_NAME_KEY = 'parlons.displayName';

export function getStoredUserId(): string | null {
  return localStorage.getItem(USER_ID_KEY);
}

export function getStoredDisplayName(): string {
  return localStorage.getItem(USER_NAME_KEY) ?? '';
}

export function saveProfile(id: string, displayName: string): void {
  localStorage.setItem(USER_ID_KEY, id);
  localStorage.setItem(USER_NAME_KEY, displayName);
}

export function ensureUserId(): string {
  const existing = getStoredUserId();
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(USER_ID_KEY, id);
  return id;
}
