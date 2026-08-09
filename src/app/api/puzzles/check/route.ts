import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CrosswordCell } from '@/lib/crossword/types';

interface CheckRequestBody {
  puzzleId: string;
  userInputs: (string | null)[][];
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckRequestBody = await request.json();
    const { puzzleId, userInputs } = body;

    if (!puzzleId || !userInputs) {
      return NextResponse.json(
        { error: 'Missing puzzleId or userInputs' },
        { status: 400 }
      );
    }

    // Fetch the puzzle
    const puzzle = await db.crosswordPuzzle.findUnique({
      where: { id: puzzleId },
    });

    if (!puzzle) {
      return NextResponse.json(
        { error: 'Puzzle not found' },
        { status: 404 }
      );
    }

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

    // Update or create user progress if puzzle is complete
    if (allCorrect) {
      await db.userProgress.upsert({
        where: {
          puzzleId_userId: {
            puzzleId,
            userId: 'anonymous',
          },
        },
        create: {
          puzzleId,
          userId: 'anonymous',
          completed: true,
          completedAt: new Date(),
          progress: JSON.stringify(userInputs),
        },
        update: {
          completed: true,
          completedAt: new Date(),
          progress: JSON.stringify(userInputs),
        },
      });
    } else {
      // Save partial progress
      await db.userProgress.upsert({
        where: {
          puzzleId_userId: {
            puzzleId,
            userId: 'anonymous',
          },
        },
        create: {
          puzzleId,
          userId: 'anonymous',
          completed: false,
          progress: JSON.stringify(userInputs),
        },
        update: {
          progress: JSON.stringify(userInputs),
        },
      });
    }

    return NextResponse.json({
      correct: allCorrect,
      incorrectCells,
      completionPercent,
    });
  } catch (error) {
    console.error('Error checking puzzle answers:', error);
    return NextResponse.json(
      { error: 'Failed to check answers' },
      { status: 500 }
    );
  }
}
