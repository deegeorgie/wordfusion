import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { CrosswordCell } from '@/lib/crossword/types';
import { getAccessiblePuzzle } from '@/lib/puzzle-access';
import { getProgressUser, setProgressCookie } from '@/lib/progress-user';

interface CheckRequestBody {
  puzzleId: string;
  userInputs: (string | null)[][];
  timeSpent?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckRequestBody = await request.json();
    const { puzzleId, userInputs, timeSpent = 0 } = body;

    if (!puzzleId || !Array.isArray(userInputs)) {
      return NextResponse.json(
        { error: 'Missing puzzleId or userInputs' },
        { status: 400 }
      );
    }

    // Fetch the puzzle
    const puzzle = await getAccessiblePuzzle(puzzleId);

    if (!puzzle) {
      return NextResponse.json(
        { error: 'Puzzle not found' },
        { status: 404 }
      );
    }

    const progressUser = await getProgressUser(request);
    const session = await getServerSession(authOptions);
    // Parse grid data from DB
    const grid: CrosswordCell[][] = JSON.parse(puzzle.gridData);

    const incorrectCells: { row: number; col: number }[] = [];
    let totalCells = 0;
    let filledCells = 0;
    let correctCells = 0;

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const cell = grid[r][c];

        // Skip black cells
        if (cell.isBlack) continue;

        totalCells++;
        const userLetter = userInputs[r]?.[c];

        if (userLetter !== null && userLetter !== undefined && userLetter !== '') {
          filledCells++;
          // Compare case-insensitively for French accents (normalized)
          const normalizedUser = userLetter.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
          const normalizedCorrect = cell.letter.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

          if (normalizedUser === normalizedCorrect) {
            correctCells++;
          } else {
            incorrectCells.push({ row: r, col: c });
          }
        }
      }
    }

    const allCorrect = incorrectCells.length === 0 && filledCells === totalCells;
    const completionPercent = totalCells > 0 ? Math.round((correctCells / totalCells) * 100) : 0;

    let coinReward = 0;

    // Update progress and award the first completion atomically for signed-in users.
    if (allCorrect) {
      coinReward = await db.$transaction(async (tx) => {
        const previousProgress = await tx.userProgress.findUnique({
          where: {
            puzzleId_userId: {
              puzzleId,
              userId: progressUser.userId,
            },
          },
        });

        await tx.userProgress.upsert({
          where: {
            puzzleId_userId: {
              puzzleId,
              userId: progressUser.userId,
            },
          },
          create: {
            puzzleId,
            userId: progressUser.userId,
            completed: true,
            completedAt: new Date(),
            progress: JSON.stringify(userInputs),
            timeSpent: Number.isInteger(timeSpent) && timeSpent >= 0 ? timeSpent : 0,
          },
          update: {
            completed: true,
            completedAt: new Date(),
            progress: JSON.stringify(userInputs),
            timeSpent: Number.isInteger(timeSpent) && timeSpent >= 0 ? timeSpent : 0,
          },
        });

        if (!session?.user.id || previousProgress?.completed) return 0;

        const amount = 10 + Math.max(0, puzzle.difficulty - 1) * 5;
        const wallet = await tx.userWallet.upsert({
          where: { userId: session.user.id },
          create: { userId: session.user.id, balance: amount },
          update: { balance: { increment: amount } },
        });

        await tx.coinTransaction.create({
          data: {
            userId: session.user.id,
            walletId: wallet.id,
            amount,
            reason: 'puzzle_completion',
            referenceKey: `puzzle-completion:${session.user.id}:${puzzleId}`,
            balanceAfter: wallet.balance,
          },
        });

        return amount;
      });
    } else {
      // Save partial progress
      await db.userProgress.upsert({
        where: {
          puzzleId_userId: {
            puzzleId,
            userId: progressUser.userId,
          },
        },
        create: {
          puzzleId,
          userId: progressUser.userId,
          completed: false,
          progress: JSON.stringify(userInputs),
          timeSpent: Number.isInteger(timeSpent) && timeSpent >= 0 ? timeSpent : 0,
        },
        update: {
          progress: JSON.stringify(userInputs),
          timeSpent: Number.isInteger(timeSpent) && timeSpent >= 0 ? timeSpent : 0,
        },
      });
    }

    const response = NextResponse.json({
      correct: allCorrect,
      incorrectCells,
      completionPercent,
      coinReward,
    });
    return setProgressCookie(response, progressUser.userId, progressUser.setCookie);
  } catch (error) {
    console.error('Error checking puzzle answers:', error);
    return NextResponse.json(
      { error: 'Failed to check answers' },
      { status: 500 }
    );
  }
}
