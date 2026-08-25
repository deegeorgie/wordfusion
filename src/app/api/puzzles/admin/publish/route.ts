import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-guard';

interface PublishRequestBody {
  puzzleId: string;
  published: boolean;
  publishDate?: string;
}

export async function POST(request: NextRequest) {
  const { error: authErr } = await requireRole('ADMIN');
  if (authErr) return authErr;

  try {
    const body: PublishRequestBody = await request.json();
    const { puzzleId, published, publishDate } = body;

    if (!puzzleId || published === undefined) {
      return NextResponse.json(
        { error: 'Missing puzzleId or published status' },
        { status: 400 }
      );
    }

    // Verify the puzzle exists
    const existing = await db.crosswordPuzzle.findUnique({
      where: { id: puzzleId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Puzzle not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: {
      published: boolean;
      publishDate?: Date | null;
      firstPublishedAt?: Date | null;
    } = {
      published,
    };

    if (publishDate) {
      updateData.publishDate = new Date(publishDate);
    } else if (published && !existing.publishDate) {
      // If publishing without a date and no existing date, set to now
      updateData.publishDate = new Date();
    } else if (!published) {
      // Unpublishing: clear the publish date (but keep firstPublishedAt)
      updateData.publishDate = null;
    }

    // Set firstPublishedAt only on the very first publish
    if (published && !existing.firstPublishedAt) {
      updateData.firstPublishedAt = new Date();
    }

    const updated = await db.crosswordPuzzle.update({
      where: { id: puzzleId },
      data: updateData,
      select: {
        id: true,
        title: true,
        difficulty: true,
        rows: true,
        cols: true,
        publishDate: true,
        published: true,
      },
    });

    return NextResponse.json({
      puzzle: {
        ...updated,
        publishDate: updated.publishDate?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error('Error updating puzzle publish status:', error);
    return NextResponse.json(
      { error: 'Failed to update puzzle' },
      { status: 500 }
    );
  }
}
