/** Backend origin for static uploads (`/uploads/...`). NEXT_PUBLIC_API_URL ends with `/api`. */
export function getBackendOrigin(): string {
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050/api';
  return api.replace(/\/api\/?$/, '');
}

/** Resolve stored `fileUrl` (e.g. `/uploads/foo.pdf`) to an absolute URL for download/open. */
export function getPublicFileUrl(fileUrl: string): string {
  if (!fileUrl) return '';
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) return fileUrl;
  const base = getBackendOrigin().replace(/\/$/, '');
  const path = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
  return `${base}${path}`;
}
