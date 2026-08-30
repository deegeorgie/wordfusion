import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { puzzleFromDbFormat } from '@/lib/crossword/utils';
import { getAccessiblePuzzle } from '@/lib/puzzle-access';
import { getProgressUser, setProgressCookie } from '@/lib/progress-user';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch the puzzle
    const puzzle = await getAccessiblePuzzle(id);

    if (!puzzle) {
      return NextResponse.json(
        { error: 'Puzzle not found' },
        { status: 404 }
      );
    }

    // Parse full puzzle data
    const puzzleData = puzzleFromDbFormat(
      puzzle.title,
      puzzle.description,
      puzzle.difficulty,
      puzzle.rows,
      puzzle.cols,
      puzzle.gridData,
      puzzle.wordsData,
      puzzle.cluesData
    );

    const progressUser = await getProgressUser(request);
    const userProgress = await db.userProgress.findUnique({
      where: { puzzleId_userId: { puzzleId: id, userId: progressUser.userId } },
    });

    // Count total published puzzles for navigation
    const totalPublished = await db.crosswordPuzzle.count({
      where: { published: true },
    });

    const response = NextResponse.json({
      puzzle: puzzleData,
      puzzleId: puzzle.id,
      language: puzzle.language,
      categoryId: puzzle.categoryId,
      packId: puzzle.packId,
      progress: userProgress
        ? {
            id: userProgress.id,
            completed: userProgress.completed,
            timeSpent: userProgress.timeSpent,
            hintsUsed: userProgress.hintsUsed,
            progress: JSON.parse(userProgress.progress),
            completedAt: userProgress.completedAt?.toISOString() ?? null,
          }
        : null,
      totalPublished,
    });
    return setProgressCookie(response, progressUser.userId, progressUser.setCookie);
  } catch (error) {
    console.error('Error fetching puzzle:', error);
    return NextResponse.json(
      { error: 'Failed to fetch puzzle' },
      { status: 500 }
    );
  }
}
