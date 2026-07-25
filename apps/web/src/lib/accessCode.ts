const KEY = 'morrai.accessCode';

/** Sent on every request; the server ignores it when no code is configured. */
export const ACCESS_CODE_HEADER = 'x-access-code';
/** Server's marker that the request was refused for want of a code. */
export const ACCESS_CODE_REQUIRED = 'ACCESS_CODE_REQUIRED';

export function getAccessCode(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveAccessCode(code: string): void {
  try {
    localStorage.setItem(KEY, code.trim());
  } catch {
    // Private browsing: the code simply won't be remembered between visits.
  }
}

export function clearAccessCode(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

/** True when a failure was specifically "you need the access code". */
export function isAccessCodeError(err: unknown): boolean {
  return err instanceof Error && err.message.includes(ACCESS_CODE_REQUIRED);
}
