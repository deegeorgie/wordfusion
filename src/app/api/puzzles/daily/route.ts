import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { getProgressUser, setProgressCookie } from '@/lib/progress-user';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const languageParam = searchParams.get('language');

    const now = new Date();

    // Scheduled publication is handled by /api/cron/publish-puzzles.
    // This endpoint is read-only so a visitor cannot mutate publication state.

    // ── Build where clause: all published puzzles ──
    const where: Record<string, unknown> = {
      published: true,
    };

    if (languageParam && ['fr', 'en'].includes(languageParam)) {
      where.language = languageParam;
    }

    // ── Fetch all published puzzles, newest first ──
    const puzzles = await db.crosswordPuzzle.findMany({
      where,
      orderBy: {
        publishDate: 'desc',
      },
      select: {
        id: true,
        puzzleNumber: true,
        title: true,
        difficulty: true,
        language: true,
        description: true,
        rows: true,
        cols: true,
        publishDate: true,
        firstPublishedAt: true,
        isPremium: true,
        unlockCost: true,
        categoryId: true,
        packId: true,
        creatorId: true,
        category: {
          select: { id: true, name: true, slug: true, icon: true },
        },
        pack: {
          select: { id: true, name: true, icon: true },
        },
      },
    });

    const progressUser = await getProgressUser(request);
    const session = await getServerSession(authOptions);
    const unlockedPuzzleIds = session?.user.id
      ? new Set(
          (await db.puzzleUnlock.findMany({
            where: { userId: session.user.id, puzzleId: { in: puzzles.map((puzzle) => puzzle.id) } },
            select: { puzzleId: true },
          })).map((unlock) => unlock.puzzleId),
        )
      : new Set<string>();
    const progress = await db.userProgress.findMany({
      where: { userId: progressUser.userId, puzzleId: { in: puzzles.map((puzzle) => puzzle.id) } },
      select: { puzzleId: true, completed: true, timeSpent: true, updatedAt: true },
    });
    const progressByPuzzleId = new Map(progress.map((entry) => [entry.puzzleId, entry]));

    const summaries = puzzles.map((p) => ({
      id: p.id,
      puzzleNumber: p.puzzleNumber,
      title: p.title,
      difficulty: p.difficulty,
      language: p.language,
      description: p.description,
      rows: p.rows,
      cols: p.cols,
      publishDate: p.publishDate?.toISOString() ?? '',
      firstPublishedAt: p.firstPublishedAt?.toISOString() ?? null,
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      categoryIcon: p.category?.icon ?? null,
      packId: p.packId,
      packName: p.pack?.name ?? null,
      packIcon: p.pack?.icon ?? null,
      isPremium: p.isPremium,
      unlockCost: p.unlockCost,
      isUnlocked: !p.isPremium || unlockedPuzzleIds.has(p.id) ||
        session?.user.role === 'ADMIN' || p.creatorId === session?.user.id ||
        progressByPuzzleId.get(p.id)?.completed === true,
      categorySlug: p.category?.slug ?? null,
      completed: progressByPuzzleId.get(p.id)?.completed ?? false,
      timeSpent: progressByPuzzleId.get(p.id)?.timeSpent ?? 0,
      lastPlayedAt: progressByPuzzleId.get(p.id)?.updatedAt.toISOString() ?? null,
    }));

    return setProgressCookie(NextResponse.json({ puzzles: summaries }), progressUser.userId, progressUser.setCookie);
  } catch (error) {
    console.error('Error fetching puzzles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch puzzles' },
      { status: 500 }
    );
  }
}
