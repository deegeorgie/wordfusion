import type { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  createAnonymousProgressId,
  signProgressToken,
  verifyProgressToken,
} from '@/lib/progress-token';

const PROGRESS_COOKIE = 'wordfusion-progress-id';

export async function getProgressUser(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user.id) return { userId: session.user.id, setCookie: false };

  const verified = verifyProgressToken(request.cookies.get(PROGRESS_COOKIE)?.value);
  // Legacy unsigned cookies are re-signed on the next response.
  if (verified) return { userId: verified.userId, setCookie: verified.legacy };

  return { userId: createAnonymousProgressId(), setCookie: true };
}

export function getAnonymousProgressUserId(request: NextRequest): string | null {
  return verifyProgressToken(request.cookies.get(PROGRESS_COOKIE)?.value)?.userId ?? null;
}

export function setProgressCookie(response: NextResponse, userId: string, needed: boolean) {
  if (!needed) return response;
  response.cookies.set(PROGRESS_COOKIE, signProgressToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export function clearProgressCookie(response: NextResponse) {
  response.cookies.set(PROGRESS_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
