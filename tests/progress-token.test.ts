import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createAnonymousProgressId,
  signProgressToken,
  verifyProgressToken,
} from '../src/lib/progress-token';

const SECRET = 'test-progress-secret';
const ANONYMOUS_ID = 'anon:0b7f4c9e-7b2d-4e1e-9a52-3f6c8f0f9d11';
const LEGACY_ID = '9d1c4f2a-6a3b-4b8e-8f0a-2c5d7e9b1a44';

describe('progress token', () => {
  beforeEach(() => {
    process.env.PROGRESS_COOKIE_SECRET = SECRET;
    delete process.env.NEXTAUTH_SECRET;
  });

  afterEach(() => {
    delete process.env.PROGRESS_COOKIE_SECRET;
    delete process.env.NEXTAUTH_SECRET;
  });

  it('signs and verifies an anonymous id', () => {
    const token = signProgressToken(ANONYMOUS_ID);
    expect(token.startsWith(`${ANONYMOUS_ID}.`)).toBe(true);
    expect(verifyProgressToken(token)).toEqual({ userId: ANONYMOUS_ID, legacy: false });
  });

  it('rejects a tampered id', () => {
    const token = signProgressToken(ANONYMOUS_ID);
    const signature = token.slice(token.lastIndexOf('.') + 1);
    const tampered = `${createAnonymousProgressId()}.${signature}`;
    expect(verifyProgressToken(tampered)).toBeNull();
  });

  it('rejects a tampered signature', () => {
    const token = signProgressToken(ANONYMOUS_ID);
    const tampered = `${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`;
    expect(verifyProgressToken(tampered)).toBeNull();
  });

  it('rejects a token signed with another secret', () => {
    const token = signProgressToken(ANONYMOUS_ID);
    process.env.PROGRESS_COOKIE_SECRET = 'another-secret';
    expect(verifyProgressToken(token)).toBeNull();
  });

  it('rejects signed tokens for non-anonymous ids', () => {
    const token = signProgressToken('clx0realuserid');
    expect(verifyProgressToken(token)).toBeNull();
  });

  it('rejects malformed values', () => {
    expect(verifyProgressToken(undefined)).toBeNull();
    expect(verifyProgressToken(null)).toBeNull();
    expect(verifyProgressToken('')).toBeNull();
    expect(verifyProgressToken('not-a-token')).toBeNull();
    expect(verifyProgressToken('anon:not-a-uuid')).toBeNull();
    expect(verifyProgressToken(`${ANONYMOUS_ID}.short`)).toBeNull();
  });

  it('accepts a legacy unsigned uuid so old progress keeps resolving', () => {
    expect(verifyProgressToken(LEGACY_ID)).toEqual({ userId: LEGACY_ID, legacy: true });
  });

  it('generates unique anonymous ids in their own namespace', () => {
    const first = createAnonymousProgressId();
    const second = createAnonymousProgressId();
    expect(first).toMatch(/^anon:[0-9a-f-]{36}$/i);
    expect(first).not.toBe(second);
  });
});
