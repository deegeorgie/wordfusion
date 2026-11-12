import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const TOKEN_CONTEXT = 'wordfusion-progress-cookie:v1';
const ANONYMOUS_PREFIX = 'anon:';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/i;
const DEV_SECRET = 'wordfusion-insecure-development-secret';

export function createAnonymousProgressId(): string {
  return `${ANONYMOUS_PREFIX}${randomUUID()}`;
}

export function isAnonymousProgressId(value: string): boolean {
  if (value.startsWith(ANONYMOUS_PREFIX)) {
    return UUID_PATTERN.test(value.slice(ANONYMOUS_PREFIX.length));
  }
  return UUID_PATTERN.test(value);
}

function progressSecret(): string {
  const secret = process.env.PROGRESS_COOKIE_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PROGRESS_COOKIE_SECRET or NEXTAUTH_SECRET must be configured');
  }
  return DEV_SECRET;
}

function signatureFor(userId: string, secret: string): string {
  return createHmac('sha256', secret).update(`${TOKEN_CONTEXT}:${userId}`).digest('hex');
}

export function signProgressToken(userId: string): string {
  return `${userId}.${signatureFor(userId, progressSecret())}`;
}

export interface VerifiedProgressToken {
  userId: string;
  /** Pre-signing cookie: still accepted so existing anonymous progress is not lost, but rewritten as a signed token. */
  legacy: boolean;
}

export function verifyProgressToken(raw: string | null | undefined): VerifiedProgressToken | null {
  const token = raw?.trim();
  if (!token) return null;

  // Legacy cookies were a bare UUID used directly as the database key. They
  // stay on the bare key so their existing progress rows keep resolving.
  if (UUID_PATTERN.test(token)) return { userId: token, legacy: true };

  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;

  const userId = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!isAnonymousProgressId(userId) || !SIGNATURE_PATTERN.test(signature)) return null;

  const expected = Buffer.from(signatureFor(userId, progressSecret()), 'hex');
  const received = Buffer.from(signature, 'hex');
  if (expected.length !== received.length) return null;
  if (!timingSafeEqual(expected, received)) return null;

  return { userId, legacy: false };
}
