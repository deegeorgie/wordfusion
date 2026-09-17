import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ completions: [] }, { status: 401 });
  }

  const progress = await db.userProgress.findMany({
    where: { userId: session.user.id, completed: true },
    orderBy: { completedAt: 'asc' },
  });
  const puzzles = await db.crosswordPuzzle.findMany({
    where: { id: { in: progress.map((item) => item.puzzleId) } },
    select: { id: true, title: true, difficulty: true, language: true },
  });
  const puzzlesById = new Map(puzzles.map((puzzle) => [puzzle.id, puzzle]));

  return NextResponse.json({
    completions: progress.flatMap((item) => {
      const puzzle = puzzlesById.get(item.puzzleId);
      if (!puzzle) return [];
      return [{
        date: (item.completedAt ?? item.updatedAt).toISOString(),
        puzzleId: item.puzzleId,
        time: item.timeSpent,
        difficulty: puzzle.difficulty,
        title: puzzle.title,
        language: puzzle.language,
      }];
    }),
  });
}