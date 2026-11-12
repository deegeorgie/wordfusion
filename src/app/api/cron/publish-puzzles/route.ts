import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatPuzzleIssues, validatePuzzleRecord } from '@/lib/crossword/validate-generated';
export const dynamic = 'force-dynamic';

/**
 * Vercel Cron endpoint.
 * Publishes all puzzles whose scheduled publication date has arrived.
 * Vercel sends Authorization: Bearer <CRON_SECRET> for configured cron jobs.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[cron] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 });
  }

  const authorization = request.headers.get('authorization');
  if (authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();

    const schedule = await db.publishingSchedule.findFirst({ orderBy: { createdAt: 'desc' } });
    if (schedule && !schedule.isActive) {
      return NextResponse.json({ ok: true, published: 0, ranAt: now.toISOString() });
    }

    const puzzlesPerDay = schedule?.puzzlesPerDay ?? 1;
    // Read a bounded window so invalid drafts can be skipped without starving
    // the day's quota; the window is only a lookahead, not a publish list.
    const duePuzzles = await db.crosswordPuzzle.findMany({
      where: {
        publishDate: { lte: now },
        published: false,
        firstPublishedAt: null,
      },
      orderBy: { publishDate: 'asc' },
      take: Math.max(puzzlesPerDay * 5, 20),
      select: { id: true, rows: true, cols: true, gridData: true, wordsData: true, cluesData: true },
    });

    const publishableIds: string[] = [];
    let skipped = 0;
    for (const puzzle of duePuzzles) {
      if (publishableIds.length >= puzzlesPerDay) break;
      const issues = validatePuzzleRecord(puzzle, { requirePublishable: true });
      if (issues.length) {
        skipped++;
        console.warn(`[cron] Skipping puzzle ${puzzle.id}: ${formatPuzzleIssues(issues)}`);
        continue;
      }
      publishableIds.push(puzzle.id);
    }

    const result = publishableIds.length === 0 ? { count: 0 } : await db.crosswordPuzzle.updateMany({
      where: { id: { in: publishableIds }, published: false, firstPublishedAt: null },
      data: { published: true, firstPublishedAt: now },
    });

    console.log(`[cron] Published ${result.count} puzzle(s), skipped ${skipped} invalid`);

    return NextResponse.json({
      ok: true,
      published: result.count,
      skipped,
      ranAt: now.toISOString(),
    });
  } catch (error) {
    console.error('[cron] Failed to publish puzzles:', error);
    return NextResponse.json(
      { error: 'Failed to publish scheduled puzzles' },
      { status: 500 },
    );
  }
}
