import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAccessiblePuzzle } from '@/lib/puzzle-access';
import { getProgressUser, setProgressCookie } from '@/lib/progress-user';

interface ProgressBody {
  puzzleId: string;
  userInputs: (string | null)[][];
  timeSpent: number;
  reset?: boolean;
}

/** Persist in-progress work without revealing or checking any answers. */
export async function POST(request: NextRequest) {
  try {
    const { puzzleId, userInputs, timeSpent, reset = false } = await request.json() as ProgressBody;
    if (!puzzleId || (!reset && (!Array.isArray(userInputs) || !Number.isInteger(timeSpent) || timeSpent < 0))) {
      return NextResponse.json({ error: 'Invalid progress payload' }, { status: 400 });
    }

    const puzzle = await getAccessiblePuzzle(puzzleId);
    if (!puzzle) return NextResponse.json({ error: 'Puzzle not found' }, { status: 404 });

    const progressUser = await getProgressUser(request);
    await db.userProgress.upsert({
      where: { puzzleId_userId: { puzzleId, userId: progressUser.userId } },
      create: reset
        ? {
            puzzleId,
            userId: progressUser.userId,
            completed: false,
            completedAt: null,
            progress: JSON.stringify({}),
            timeSpent: 0,
            magicWordsClaimed: JSON.stringify([]),
            revealedCells: JSON.stringify([]),
          }
        : { puzzleId, userId: progressUser.userId, progress: JSON.stringify(userInputs), timeSpent },
      update: reset
        ? {
            completed: false,
            completedAt: null,
            progress: JSON.stringify({}),
            timeSpent: 0,
            magicWordsClaimed: JSON.stringify([]),
            revealedCells: JSON.stringify([]),
          }
        : { progress: JSON.stringify(userInputs), timeSpent },
    });

    return setProgressCookie(NextResponse.json({ ok: true }), progressUser.userId, progressUser.setCookie);
  } catch (error) {
    console.error('Error saving puzzle progress:', error);
    return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 });
  }
}
