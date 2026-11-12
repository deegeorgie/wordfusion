import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { puzzleFromDbFormat } from '@/lib/crossword/utils';
import { parseRevealedCells, toPlayerPuzzle } from '@/lib/crossword/server-puzzle';
import { getAccessiblePuzzle, releasedPuzzleFilter } from '@/lib/puzzle-access';
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

    // Only revealed cells may carry their letter to a player. The puzzle
    // editor legitimately needs the full solution, so its owner/admin gets
    // the unredacted payload.
    const revealedKeys = parseRevealedCells(userProgress?.revealedCells);
    const session = await getServerSession(authOptions);
    const canEdit = session?.user.role === 'ADMIN' || session?.user.id === puzzle.creatorId;
    const puzzleForClient = canEdit
      ? { ...puzzleData, magicWords: JSON.parse(puzzle.magicWords || '[]') as string[] }
      : toPlayerPuzzle(puzzleData, revealedKeys);

    // Count total published puzzles for navigation
    const totalPublished = await db.crosswordPuzzle.count({
      where: {
        published: true,
        ...(session?.user.role === 'ADMIN' ? {} : releasedPuzzleFilter()),
      },
    });

    const response = NextResponse.json({
      puzzle: puzzleForClient,
      puzzleId: puzzle.id,
      language: puzzle.language,
      categoryId: puzzle.categoryId,
      categoryIds: puzzle.categoryMemberships.map((membership) => membership.categoryId),
      packId: puzzle.packId,
      packIds: puzzle.collectionMemberships.map((membership) => membership.packId),
      isPremium: puzzle.isPremium,
      unlockCost: puzzle.unlockCost,
      progress: userProgress
        ? {
            id: userProgress.id,
            completed: userProgress.completed,
            timeSpent: userProgress.timeSpent,
            hintsUsed: userProgress.hintsUsed,
            progress: JSON.parse(userProgress.progress),
            magicWordsClaimed: JSON.parse(userProgress.magicWordsClaimed || '[]'),
            revealedCells: [...revealedKeys],
            completedAt: userProgress.completedAt?.toISOString() ?? null,
            updatedAt: userProgress.updatedAt.toISOString(),
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
