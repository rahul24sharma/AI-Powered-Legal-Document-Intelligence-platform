const LEGACY_TOKEN_KEY = 'token';
const AUTH_STORAGE_KEY = 'auth-storage';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;

  const direct = window.localStorage.getItem(LEGACY_TOKEN_KEY);
  if (direct) return direct;

  const persisted = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!persisted) return null;

  try {
    const parsed = JSON.parse(persisted) as {
      state?: { token?: string | null };
    };
    return parsed.state?.token ?? null;
  } catch {
    return null;
  }
}

export function clearPersistedAuth(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}
