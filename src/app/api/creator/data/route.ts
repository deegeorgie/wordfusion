import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-guard';

/**
 * GET /api/creator/data
 * Returns categories, packs, and the creator's own puzzles.
 * Requires CREATOR role or higher.
 */
export async function GET() {
  const { error: authErr, session } = await requireRole('CREATOR');
  if (authErr) return authErr;

  try {
    const categories = await db.category.findMany({
      orderBy: [{ language: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { puzzles: true } } },
    });

    const packs = await db.pack.findMany({
      orderBy: [{ language: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { puzzles: true } } },
    });

    // Creators can see their own puzzles (and all puzzles if they are also admin)
    const isAdmin = session!.user.role === 'ADMIN';
    const puzzles = await db.crosswordPuzzle.findMany({
      where: isAdmin ? {} : { creatorId: session!.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        difficulty: true,
        language: true,
        categoryId: true,
        packId: true,
        rows: true,
        cols: true,
        publishDate: true,
        published: true,
        createdAt: true,
        category: {
          select: { id: true, name: true, slug: true, icon: true },
        },
        pack: {
          select: { id: true, name: true, icon: true },
        },
      },
    });

    const puzzleList = puzzles.map((p) => ({
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      language: p.language,
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      categorySlug: p.category?.slug ?? null,
      categoryIcon: p.category?.icon ?? null,
      packId: p.packId,
      packName: p.pack?.name ?? null,
      packIcon: p.pack?.icon ?? null,
      rows: p.rows,
      cols: p.cols,
      publishDate: p.publishDate?.toISOString() ?? null,
      published: p.published,
      createdAt: p.createdAt.toISOString(),
    }));

    return NextResponse.json({
      puzzles: puzzleList,
      categories,
      packs,
      schedule: { puzzlesPerDay: 1, isActive: true }, // placeholder, not used by creators
    });
  } catch (error) {
    console.error('Error fetching creator data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
