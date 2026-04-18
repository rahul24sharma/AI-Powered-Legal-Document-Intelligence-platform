import { APIError } from '@/lib/api';

/** User-facing message from auth/API failures (validation arrays, network, etc.). */
export function getAxiosErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof APIError)) {
    return err instanceof Error ? err.message : fallback;
  }

  if (err.code === 'ERR_NETWORK' || err.code === 'ERR_TIMEOUT' || !err.status) {
    return 'Cannot reach the API server. Start the backend (same port as NEXT_PUBLIC_API_URL) and try again.';
  }

  const data = err.data;
  if (data && typeof data === 'object') {
    const d = data as {
      message?: string;
      errors?: Array<{ msg?: string; message?: string }>;
    };
    if (typeof d.message === 'string' && d.message.trim()) return d.message;
    const first = d.errors?.[0];
    const v =
      typeof first?.msg === 'string'
        ? first.msg
        : typeof first?.message === 'string'
          ? first.message
          : undefined;
    if (v?.trim()) return v;
  }

  const reqUrl = err.url ?? '';
  if (err.status === 401) {
    if (reqUrl.includes('/auth/login') || reqUrl.includes('/auth/register')) {
      return 'Invalid email or password.';
    }
    return 'Your session expired or you were signed out. Sign in again.';
  }
  if (err.status === 400) return 'Invalid request. Check your email format and password.';

  return fallback;
}
