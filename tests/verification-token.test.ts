import { describe, expect, it } from 'vitest';
import {
  buildVerificationUrl,
  createVerificationTokenValue,
  hashVerificationToken,
  isVerificationTokenExpired,
  normalizeEmail,
} from '../src/lib/verification-token';

describe('verification tokens', () => {
  it('normalizes account emails', () => {
    expect(normalizeEmail('  Player@Example.COM ')).toBe('player@example.com');
  });

  it('creates unguessable base64url token values', () => {
    const first = createVerificationTokenValue();
    const second = createVerificationTokenValue();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
  });

  it('hashes tokens deterministically', () => {
    expect(hashVerificationToken('abc')).toBe(hashVerificationToken('abc'));
    expect(hashVerificationToken('abc')).not.toBe(hashVerificationToken('abd'));
    expect(hashVerificationToken('abc')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('builds an absolute verification link', () => {
    expect(buildVerificationUrl('token value', 'https://wordfusion.example/'))
      .toBe('https://wordfusion.example/api/auth/verify-email?token=token%20value');
  });

  it('falls back to the local app URL', () => {
    const previous = process.env.NEXTAUTH_URL;
    delete process.env.NEXTAUTH_URL;
    expect(buildVerificationUrl('abc')).toBe('http://localhost:3000/api/auth/verify-email?token=abc');
    if (previous !== undefined) process.env.NEXTAUTH_URL = previous;
  });

  it('detects expired links, including the exact expiry instant', () => {
    const now = new Date('2026-11-11T12:00:00Z');
    expect(isVerificationTokenExpired(new Date('2026-11-11T11:59:59Z'), now)).toBe(true);
    expect(isVerificationTokenExpired(now, now)).toBe(true);
    expect(isVerificationTokenExpired(new Date('2026-11-11T12:00:01Z'), now)).toBe(false);
    expect(isVerificationTokenExpired('2026-11-12T00:00:00.000Z', now)).toBe(false);
  });
});
