import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CrosswordCell, Clue } from '@/lib/crossword/types';
import { getAccessiblePuzzle } from '@/lib/puzzle-access';
import { getProgressUser, setProgressCookie } from '@/lib/progress-user';

interface HintRequestBody {
  puzzleId: string;
  row: number;
  col: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: HintRequestBody = await request.json();
    const { puzzleId, row, col } = body;

    if (!puzzleId || !Number.isInteger(row) || !Number.isInteger(col)) {
      return NextResponse.json(
        { error: 'Missing puzzleId, row, or col' },
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
    // Parse grid and clues
    const grid: CrosswordCell[][] = JSON.parse(puzzle.gridData);
    const clues: Clue[] = JSON.parse(puzzle.cluesData);

    // Validate cell coordinates
    if (row < 0 || row >= grid.length || col < 0 || col >= (grid[0]?.length ?? 0)) {
      return NextResponse.json(
        { error: 'Invalid cell coordinates' },
        { status: 400 }
      );
    }

    const cell = grid[row][col];

    if (cell.isBlack) {
      return NextResponse.json(
        { error: 'Cannot reveal a black cell' },
        { status: 400 }
      );
    }

    // Increment hint counter on user progress
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
        hintsUsed: 1,
      },
      update: {
        hintsUsed: {
          increment: 1,
        },
      },
    });

    // Find relevant clues for this cell
    const relevantClues = clues.filter((clue) => {
      // Check across clues
      if (clue.direction === 'across') {
        // The clue's word spans from some starting col to the right
        // Check if this cell is within any across word starting at this row
        for (let c = 0; c < (grid[row]?.length ?? 0); c++) {
          if (grid[row][c].number === clue.number && !grid[row][c].isBlack) {
            // Found the word start, check if our cell is part of it
            let len = 0;
            for (let cc = c; cc < (grid[row]?.length ?? 0) && !grid[row][cc].isBlack; cc++) {
              len++;
            }
            if (col >= c && col < c + len) {
              return true;
            }
          }
        }
      }
      // Check down clues
      if (clue.direction === 'down') {
        for (let r = 0; r < grid.length; r++) {
          if (grid[r][col]?.number === clue.number && !grid[r][col].isBlack) {
            let len = 0;
            for (let rr = r; rr < grid.length && !grid[rr][col].isBlack; rr++) {
              len++;
            }
            if (row >= r && row < r + len) {
              return true;
            }
          }
        }
      }
      return false;
    });

    // Occasionally return a random word hint (30% chance)
    let wordHint: { clueNumber: number; direction: string; text: string } | null = null;
    if (Math.random() < 0.3 && relevantClues.length > 0) {
      const randomClue = relevantClues[Math.floor(Math.random() * relevantClues.length)];
      wordHint = {
        clueNumber: randomClue.number,
        direction: randomClue.direction,
        text: randomClue.text,
      };
    }

    const response = NextResponse.json({
      letter: cell.letter,
      row,
      col,
      wordHint,
    });
    return setProgressCookie(response, progressUser.userId, progressUser.setCookie);
  } catch (error) {
    console.error('Error getting hint:', error);
    return NextResponse.json(
      { error: 'Failed to get hint' },
      { status: 500 }
    );
  }
}
