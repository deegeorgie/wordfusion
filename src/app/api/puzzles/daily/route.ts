import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    // Parse date, default to today
    const now = dateParam ? new Date(dateParam + 'T00:00:00') : new Date();

    // Get start and end of the day (in local timezone)
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // ── Auto-publish puzzles whose publishDate has arrived ──
    // Any puzzle scheduled for today (or earlier) that is still unpublished
    // gets automatically published, unless the publishing schedule is disabled.
    const schedule = await db.publishingSchedule.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const scheduleActive = schedule?.isActive ?? true;

    if (scheduleActive) {
      const result = await db.crosswordPuzzle.updateMany({
        where: {
          publishDate: { lte: endOfDay },
          published: false,
        },
        data: { published: true },
      });
      if (result.count > 0) {
        console.log(`📅 Auto-published ${result.count} puzzle(s) whose date has arrived`);
      }
    }

    // ── Fetch today's published puzzles ──
    const puzzles = await db.crosswordPuzzle.findMany({
      where: {
        publishDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        published: true,
      },
      orderBy: {
        publishDate: 'asc',
      },
      select: {
        id: true,
        title: true,
        difficulty: true,
        description: true,
        rows: true,
        cols: true,
        publishDate: true,
      },
    });

    const summaries = puzzles.map((p) => ({
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      description: p.description,
      rows: p.rows,
      cols: p.cols,
      publishDate: p.publishDate?.toISOString() ?? '',
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
