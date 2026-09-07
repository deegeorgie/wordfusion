import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAccessiblePuzzle } from '@/lib/puzzle-access';

const PDF_COSTS = {
  puzzle: 5,
  answers: 15,
} as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user.id) {
      return NextResponse.json({ error: 'Connectez-vous pour télécharger un PDF' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const kind = body.kind === 'answers' ? 'answers' : body.kind === 'puzzle' ? 'puzzle' : null;
    if (!kind) return NextResponse.json({ error: 'Type de PDF invalide' }, { status: 400 });

    const { id: puzzleId } = await params;
    const accessiblePuzzle = await getAccessiblePuzzle(puzzleId);
    if (!accessiblePuzzle || !accessiblePuzzle.published) {
      return NextResponse.json({ error: 'Puzzle introuvable ou verrouillé' }, { status: 404 });
    }
    const puzzle = await db.crosswordPuzzle.findUnique({
      where: { id: puzzleId },
      select: { id: true, published: true, isPremium: true, creatorId: true },
    });
    if (!puzzle || !puzzle.published) {
      return NextResponse.json({ error: 'Puzzle introuvable' }, { status: 404 });
    }

    const isPrivileged = session.user.role === 'ADMIN' || puzzle.creatorId === session.user.id;
    if (isPrivileged) return NextResponse.json({ balance: null, charged: false });

    const cost = PDF_COSTS[kind];
    const result = await db.$transaction(async (tx) => {
      const updated = await tx.userWallet.updateMany({
        where: { userId: session.user.id, balance: { gte: cost } },
        data: { balance: { decrement: cost } },
      });
      if (updated.count !== 1) return null;

      const wallet = await tx.userWallet.findUniqueOrThrow({
        where: { userId: session.user.id },
        select: { id: true, balance: true },
      });
      await tx.coinTransaction.create({
        data: {
          userId: session.user.id,
          walletId: wallet.id,
          amount: -cost,
          reason: `pdf_download_${kind}`,
          referenceKey: `pdf-download:${session.user.id}:${puzzleId}:${kind}:${crypto.randomUUID()}`,
          balanceAfter: wallet.balance,
        },
      });
      return wallet.balance;
    });

    if (result === null) {
      return NextResponse.json({ error: `Il vous faut ${cost} pièces` }, { status: 402 });
    }
    return NextResponse.json({ balance: result, charged: true, cost });
  } catch (error) {
    console.error('Error authorizing PDF download:', error);
    return NextResponse.json({ error: 'Impossible de préparer le téléchargement' }, { status: 500 });
  }
}