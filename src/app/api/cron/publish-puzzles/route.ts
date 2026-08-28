import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

    const result = await db.crosswordPuzzle.updateMany({
      where: {
        publishDate: { lte: now },
        published: false,
        firstPublishedAt: null,
      },
      data: {
        published: true,
        firstPublishedAt: now,
      },
    });

    console.log(`[cron] Published ${result.count} puzzle(s)`);

    return NextResponse.json({
      ok: true,
      published: result.count,
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
