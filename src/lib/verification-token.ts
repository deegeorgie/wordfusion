import { createHash, randomBytes } from 'node:crypto';

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createVerificationTokenValue(): string {
  return randomBytes(32).toString('base64url');
}

export function hashVerificationToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function buildVerificationUrl(rawToken: string, appUrl?: string): string {
  const base = (appUrl || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/api/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
}

export function isVerificationTokenExpired(expiresAt: Date | string, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}
