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
    const magicWords = JSON.parse(puzzle.magicWords || '[]') as string[];

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
    let triggeredMagicWords: string[] = [];
    let magicRevealedCells: { row: number; col: number; letter: string }[] = [];
    const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

    const completedMagicWords = magicWords.filter((magicWord) => {
      const word = JSON.parse(puzzle.wordsData) as { word: string; direction: 'across' | 'down'; row: number; col: number; length: number }[];
      const placement = word.find((candidate) => normalized(candidate.word) === normalized(magicWord));
      if (!placement) return false;
      return Array.from({ length: placement.length }, (_, index) => {
        const row = placement.direction === 'across' ? placement.row : placement.row + index;
        const col = placement.direction === 'across' ? placement.col + index : placement.col;
        const input = userInputs[row]?.[col];
        return typeof input === 'string' && normalized(input) === normalized(grid[row][col].letter);
      }).every(Boolean);
    });

    const rewardResult = await db.$transaction(async (tx) => {
      const previousProgress = await tx.userProgress.findUnique({
        where: {
          puzzleId_userId: {
            puzzleId,
            userId: progressUser.userId,
          },
        },
      });

      const claimedMagicWords = new Set<string>(JSON.parse(previousProgress?.magicWordsClaimed || '[]'));
      triggeredMagicWords = completedMagicWords.filter((word) => !claimedMagicWords.has(normalized(word)));
      for (const word of triggeredMagicWords) claimedMagicWords.add(normalized(word));

      const revealedKeys = new Set<string>(JSON.parse(previousProgress?.revealedCells || '[]'));
      const filledKeys = new Set<string>();
      for (let row = 0; row < userInputs.length; row++) {
        for (let col = 0; col < (userInputs[row]?.length ?? 0); col++) {
          if (userInputs[row]?.[col]) filledKeys.add(`${row},${col}`);
        }
      }

      if (triggeredMagicWords.length > 0) {
        const revealCount = puzzle.rows === 5 && puzzle.cols === 5 ? 3 : 10;
        const availableCells: { row: number; col: number; letter: string }[] = [];
        for (let row = 0; row < grid.length; row++) {
          for (let col = 0; col < grid[row].length; col++) {
            if (!grid[row][col].isBlack && !filledKeys.has(`${row},${col}`) && !revealedKeys.has(`${row},${col}`)) {
              availableCells.push({ row, col, letter: grid[row][col].letter });
            }
          }
        }
        magicRevealedCells = availableCells.sort(() => Math.random() - 0.5).slice(0, revealCount);
        for (const cell of magicRevealedCells) revealedKeys.add(`${cell.row},${cell.col}`);
      }

      const progressData = {
        completed: allCorrect,
        completedAt: allCorrect ? new Date() : undefined,
        progress: JSON.stringify(userInputs),
        timeSpent: Number.isInteger(timeSpent) && timeSpent >= 0 ? timeSpent : 0,
        magicWordsClaimed: JSON.stringify([...claimedMagicWords]),
        revealedCells: JSON.stringify([...revealedKeys]),
      };

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
          completed: allCorrect,
          completedAt: allCorrect ? new Date() : null,
          progress: progressData.progress,
          timeSpent: progressData.timeSpent,
          magicWordsClaimed: progressData.magicWordsClaimed,
          revealedCells: progressData.revealedCells,
        },
        update: progressData,
      });

      if (!allCorrect || !session?.user.id || previousProgress?.completed) return 0;

      const amount = puzzle.rows === 5 && puzzle.cols === 5 ? 1 : 2;
      const wallet = await tx.userWallet.upsert({
        where: { userId: session.user.id },
        create: { userId: session.user.id, balance: 0 },
        update: {},
      });

      const referenceKey = `puzzle-completion:${session.user.id}:${puzzleId}`;
      const claimed = await tx.coinTransaction.createMany({
        data: {
          userId: session.user.id,
          walletId: wallet.id,
          amount,
          reason: 'puzzle_completion',
          referenceKey,
          balanceAfter: wallet.balance + amount,
        },
        skipDuplicates: true,
      });

      if (claimed.count === 0) return 0;

      await tx.userWallet.update({
        where: { userId: session.user.id },
        data: { balance: { increment: amount } },
      });

      return amount;
    });
    coinReward = rewardResult;

    const response = NextResponse.json({
      correct: allCorrect,
      incorrectCells,
      completionPercent,
      coinReward,
      magicWords: triggeredMagicWords,
      revealedCells: magicRevealedCells,
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
