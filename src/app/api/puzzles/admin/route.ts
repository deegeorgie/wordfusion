import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Fetch all puzzles (including unpublished)
    const puzzles = await db.crosswordPuzzle.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        title: true,
        difficulty: true,
        rows: true,
        cols: true,
        publishDate: true,
        published: true,
        createdAt: true,
      },
    });

    const puzzleList = puzzles.map((p) => ({
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      rows: p.rows,
      cols: p.cols,
      publishDate: p.publishDate?.toISOString() ?? null,
      published: p.published,
      createdAt: p.createdAt.toISOString(),
    }));

    // Fetch publishing schedule
    const schedule = await db.publishingSchedule.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const scheduleSettings = schedule
      ? {
          puzzlesPerDay: schedule.puzzlesPerDay,
          isActive: schedule.isActive,
        }
      : {
          puzzlesPerDay: 1,
          isActive: true,
        };

    return NextResponse.json({
      puzzles: puzzleList,
      schedule: scheduleSettings,
    });
  } catch (error) {
    console.error('Error fetching admin puzzles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch puzzles' },
      { status: 500 }
    );
  }
}
