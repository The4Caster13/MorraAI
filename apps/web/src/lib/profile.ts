const USER_ID_KEY = 'morrai.userId';
const USER_NAME_KEY = 'morrai.displayName';

/**
 * Keys used before the project was renamed from Parlons.
 *
 * Identity lives entirely in localStorage, so changing the key prefix would
 * silently orphan every session a student had already recorded — their history
 * would still be in the database, but nothing would know to ask for it. Values
 * are migrated across on first read and the old keys removed.
 */
const LEGACY_KEYS: Record<string, string> = {
  'parlons.userId': USER_ID_KEY,
  'parlons.displayName': USER_NAME_KEY,
};

let migrated = false;

function migrateLegacyKeys(): void {
  if (migrated) return;
  migrated = true;
  try {
    for (const [oldKey, newKey] of Object.entries(LEGACY_KEYS)) {
      const value = localStorage.getItem(oldKey);
      if (value !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, value);
      }
      if (value !== null) localStorage.removeItem(oldKey);
    }
  } catch {
    // Private browsing can throw on storage access; a fresh identity is a fine
    // fallback and is what would have happened anyway.
  }
}

export function getStoredUserId(): string | null {
  migrateLegacyKeys();
  return localStorage.getItem(USER_ID_KEY);
}

export function getStoredDisplayName(): string {
  migrateLegacyKeys();
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
