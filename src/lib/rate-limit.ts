type Entry = { count: number; resetAt: number };

const entries = new Map<string, Entry>();

/** In-memory protection for a single instance. Use a shared store when deployed horizontally. */
export function isRateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = entries.get(key);
  if (!entry || entry.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

export function requestClientKey(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';
}
