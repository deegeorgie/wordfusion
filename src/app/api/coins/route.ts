import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    return NextResponse.json({ balance: 0, authenticated: false });
  }

  const wallet = await db.userWallet.findUnique({
    where: { userId: session.user.id },
    select: { balance: true },
  });

  return NextResponse.json({
    balance: wallet?.balance ?? 0,
    authenticated: true,
  });
}