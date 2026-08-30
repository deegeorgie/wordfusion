import type { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const PROGRESS_COOKIE = 'wordfusion-progress-id';

export async function getProgressUser(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user.id) return { userId: session.user.id, setCookie: false };

  const existingId = request.cookies.get(PROGRESS_COOKIE)?.value;
  if (existingId) return { userId: existingId, setCookie: false };

  return { userId: crypto.randomUUID(), setCookie: true };
}

export function setProgressCookie(response: NextResponse, userId: string, needed: boolean) {
  if (!needed) return response;
  response.cookies.set(PROGRESS_COOKIE, userId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
