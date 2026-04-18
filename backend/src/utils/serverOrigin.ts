/** Resolve the backend origin used when generating absolute links for the frontend. */
export function getBackendOrigin(): string {
  const frontendApiBase = process.env.NEXT_PUBLIC_API_URL;
  if (frontendApiBase) {
    return frontendApiBase.replace(/\/api\/?$/, '');
  }

  const port = process.env.PORT || '5050';
  return `http://localhost:${port}`;
}
