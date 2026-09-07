import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAccessiblePuzzle } from '@/lib/puzzle-access';
import type { CrosswordCell } from '@/lib/crossword/types';

interface RevealRequestBody {
  puzzleId: string;
  count: 5 | 10;
  filledCells?: string[];
}

const REVEAL_COSTS = {
  5: 5,
  10: 10,
} as const;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user.id) {
      return NextResponse.json({ error: 'Connectez-vous pour utiliser vos pièces' }, { status: 401 });
    }

    const body = (await request.json()) as Partial<RevealRequestBody>;
    const { puzzleId, count, filledCells = [] } = body;
    if (!puzzleId || (count !== 5 && count !== 10) || !Array.isArray(filledCells)) {
      return NextResponse.json({ error: 'Demande de révélation invalide' }, { status: 400 });
    }

    const puzzle = await getAccessiblePuzzle(puzzleId);
    if (!puzzle) return NextResponse.json({ error: 'Puzzle introuvable' }, { status: 404 });

    const grid: CrosswordCell[][] = JSON.parse(puzzle.gridData);
    const filled = new Set(filledCells);
    const availableCells: { row: number; col: number; letter: string }[] = [];

    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        const cell = grid[row][col];
        if (!cell.isBlack && !filled.has(`${row},${col}`)) {
          availableCells.push({ row, col, letter: cell.letter });
        }
      }
    }

    if (availableCells.length === 0) {
      return NextResponse.json({ error: 'Pas assez de lettres à révéler' }, { status: 400 });
    }

    const selectedCells = availableCells
      .sort(() => Math.random() - 0.5)
      .slice(0, count);
    const cost = REVEAL_COSTS[count];

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
          reason: `letter_reveal_${count}`,
          referenceKey: `letter-reveal:${session.user.id}:${crypto.randomUUID()}`,
          balanceAfter: wallet.balance,
        },
      });

      return wallet;
    });

    if (!result) {
      return NextResponse.json({ error: `Il vous faut ${cost} pièces` }, { status: 402 });
    }

    return NextResponse.json({ cells: selectedCells, balance: result.balance });
  } catch (error) {
    console.error('Error revealing letters:', error);
    return NextResponse.json({ error: 'Impossible de révéler les lettres' }, { status: 500 });
  }
}