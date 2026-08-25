import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const languageParam = searchParams.get('language');

    // Parse date, default to today
    const now = dateParam ? new Date(dateParam + 'T00:00:00') : new Date();

    // Get start and end of the day (in local timezone)
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // ── Auto-publish puzzles whose publishDate has arrived ──
    const schedule = await db.publishingSchedule.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const scheduleActive = schedule?.isActive ?? true;

    if (scheduleActive) {
      const result = await db.crosswordPuzzle.updateMany({
        where: {
          publishDate: { lte: endOfDay },
          published: false,
          firstPublishedAt: null, // Only auto-publish those never published before
        },
        data: { published: true, firstPublishedAt: new Date() },
      });
      if (result.count > 0) {
        console.log(`📅 Auto-published ${result.count} puzzle(s) whose date has arrived`);
      }
    }

    // ── Build where clause ──
    const where: Record<string, unknown> = {
      publishDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
      published: true,
    };

    if (languageParam && ['fr', 'en'].includes(languageParam)) {
      where.language = languageParam;
    }

    // ── Fetch today's published puzzles ──
    const puzzles = await db.crosswordPuzzle.findMany({
      where,
      orderBy: {
        publishDate: 'asc',
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
        categoryId: true,
        packId: true,
        category: {
          select: { id: true, name: true, slug: true, icon: true },
        },
        pack: {
          select: { id: true, name: true, icon: true },
        },
      },
    });

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
      categorySlug: p.category?.slug ?? null,
    }));

    return NextResponse.json({ puzzles: summaries });
  } catch (error) {
    console.error('Error fetching daily puzzles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily puzzles' },
      { status: 500 }
    );
  }
}
