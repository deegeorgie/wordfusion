import { NextRequest, NextResponse } from 'next/server';
import { getAccessiblePuzzle } from '@/lib/puzzle-access';
import {
  completedClueKeys,
  evaluateInputs,
  isValidLetterMatrix,
} from '@/lib/crossword/server-puzzle';
import type { CrosswordCell, WordPlacement } from '@/lib/crossword/types';

/**
 * Read-only validation for live feedback. Never writes progress or coins;
 * answers stay on the server, only per-cell correctness is returned.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const userInputs = (body as { userInputs?: unknown } | null)?.userInputs;

    const puzzle = await getAccessiblePuzzle(id);
    if (!puzzle) {
      return NextResponse.json({ error: 'Puzzle not found' }, { status: 404 });
    }

    const grid: CrosswordCell[][] = JSON.parse(puzzle.gridData);
    if (!isValidLetterMatrix(userInputs, puzzle.rows, puzzle.cols)) {
      return NextResponse.json({ error: 'Invalid grid payload' }, { status: 400 });
    }

    const evaluation = evaluateInputs(grid, userInputs);
    const words: WordPlacement[] = JSON.parse(puzzle.wordsData);

    return NextResponse.json(
      {
        correct: evaluation.allCorrect,
        completionPercent: evaluation.completionPercent,
        filledCells: evaluation.filledCells,
        totalCells: evaluation.totalCells,
        correctCells: evaluation.correctCells,
        incorrectCells: evaluation.incorrectCells,
        completedClues: completedClueKeys(words, grid, userInputs),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Error validating puzzle answers:', error);
    return NextResponse.json({ error: 'Failed to validate answers' }, { status: 500 });
  }
}
