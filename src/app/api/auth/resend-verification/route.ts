import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { issueEmailVerification } from '@/lib/email-verification';
import { isRateLimited } from '@/lib/rate-limit';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (isRateLimited(`resend-verification:${session.user.id}`, 3, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Trop de demandes. Réessayez dans une heure.' }, { status: 429 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, emailVerified: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 });
  }
  if (user.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const { sent } = await issueEmailVerification(user, 'signup');
  if (!sent) {
    return NextResponse.json(
      { error: 'Impossible d’envoyer l’email de vérification. Réessayez plus tard.' },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, sent: true });
}
