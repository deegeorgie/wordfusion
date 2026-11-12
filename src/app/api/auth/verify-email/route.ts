import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { completePendingPurchases } from '@/lib/chariow-grants';
import { consumeVerificationToken, inspectVerificationToken } from '@/lib/email-verification';

export const dynamic = 'force-dynamic';

function redirectWith(request: NextRequest, status: string) {
  const destination = new URL('/', request.url);
  destination.searchParams.set('emailVerified', status);
  return NextResponse.redirect(destination, 303);
}

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return redirectWith(request, 'invalid');

  try {
    const inspected = await inspectVerificationToken(token);
    if (inspected.status !== 'pending' || !inspected.userId) {
      return redirectWith(request, inspected.status);
    }

    // Require the session that owns the token, otherwise a mailbox owner could
    // verify (and credit) an account they cannot sign into.
    const session = await getServerSession(authOptions);
    if (session?.user?.id !== inspected.userId) {
      return redirectWith(request, 'signin_required');
    }

    const result = await consumeVerificationToken(token);
    if (result.status !== 'verified' || !result.userId) {
      return redirectWith(request, result.status);
    }

    await completePendingPurchases(result.userId);
    return redirectWith(request, '1');
  } catch (error) {
    console.error('Email verification failed:', error);
    return redirectWith(request, 'error');
  }
}
