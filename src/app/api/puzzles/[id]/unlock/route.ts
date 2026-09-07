import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user.id) {
      return NextResponse.json({ error: 'Connectez-vous pour déverrouiller ce puzzle' }, { status: 401 });
    }

    const { id: puzzleId } = await params;
    const puzzle = await db.crosswordPuzzle.findUnique({
      where: { id: puzzleId },
      select: { id: true, creatorId: true, published: true, isPremium: true, unlockCost: true },
    });
    if (!puzzle) return NextResponse.json({ error: 'Puzzle introuvable' }, { status: 404 });
    if (!puzzle.isPremium || puzzle.unlockCost <= 0) {
      return NextResponse.json({ error: 'Ce puzzle est déjà gratuit' }, { status: 400 });
    }
    if (!puzzle.published) {
      return NextResponse.json({ error: 'Ce puzzle n’est pas encore disponible' }, { status: 400 });
    }
    if (session.user.role === 'ADMIN' || puzzle.creatorId === session.user.id) {
      return NextResponse.json({ unlocked: true, alreadyUnlocked: true });
    }

    const existing = await db.puzzleUnlock.findUnique({
      where: { userId_puzzleId: { userId: session.user.id, puzzleId } },
    });
    if (existing) return NextResponse.json({ unlocked: true, alreadyUnlocked: true });

    const result = await db.$transaction(async (tx) => {
      const walletUpdate = await tx.userWallet.updateMany({
        where: { userId: session.user.id, balance: { gte: puzzle.unlockCost } },
        data: { balance: { decrement: puzzle.unlockCost } },
      });
      if (walletUpdate.count !== 1) return null;

      const unlock = await tx.puzzleUnlock.create({
        data: { userId: session.user.id, puzzleId },
      });
      const wallet = await tx.userWallet.findUniqueOrThrow({
        where: { userId: session.user.id },
        select: { id: true, balance: true },
      });

      await tx.coinTransaction.create({
        data: {
          userId: session.user.id,
          walletId: wallet.id,
          amount: -puzzle.unlockCost,
          reason: 'puzzle_unlock',
          referenceKey: `puzzle-unlock:${session.user.id}:${puzzleId}`,
          balanceAfter: wallet.balance,
        },
      });

      return { unlock, balance: wallet.balance };
    });

    if (!result) {
      return NextResponse.json(
        { error: `Il vous faut ${puzzle.unlockCost} pièces pour déverrouiller ce puzzle` },
        { status: 402 },
      );
    }

    return NextResponse.json({ unlocked: true, balance: result.balance });
  } catch (error) {
    console.error('Error unlocking puzzle:', error);
    return NextResponse.json({ error: 'Impossible de déverrouiller le puzzle' }, { status: 500 });
  }
}