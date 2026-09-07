import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { puzzleToDbFormat } from '@/lib/crossword/utils';
import type { CrosswordPuzzleData } from '@/lib/crossword/types';
import { requireRole } from '@/lib/auth-guard';
import { createWithNextPuzzleNumber } from '@/lib/puzzle-number';

// ── Helpers ───────────────────────────────────────────────────────────

function formatPuzzleTitle(num: number): string {
  return `#${String(num).padStart(3, '0')}`;
}

// ── Types ─────────────────────────────────────────────────────────────

interface PuzzleBody {
  title?: string;  // Now optional — auto-generated from puzzleNumber
  description?: string;
  difficulty: number;
  language?: string;
  categoryId?: string | null;
  packId?: string | null;
  isPremium?: boolean;
  unlockCost?: number;
  rows: number;
  cols: number;
  grid: CrosswordPuzzleData['grid'];
  words: CrosswordPuzzleData['words'];
  clues: CrosswordPuzzleData['clues'];
  publishDate?: string | null;
  published?: boolean;
}

function validateBody(body: unknown): body is PuzzleBody {
  const b = body as Record<string, unknown>;
  return (
    Number.isInteger(b.difficulty) && (b.difficulty as number) >= 1 && (b.difficulty as number) <= 3 &&
    Number.isInteger(b.rows) && (b.rows as number) >= 2 && (b.rows as number) <= 25 &&
    Number.isInteger(b.cols) && (b.cols as number) >= 2 && (b.cols as number) <= 25 &&
    Array.isArray(b.grid) && b.grid.length === b.rows &&
    b.grid.every((row) => Array.isArray(row) && row.length === b.cols) &&
    Array.isArray(b.words) && b.words.length <= 100 &&
    Array.isArray(b.clues) && b.clues.length <= 100
  );
}

function parsePublishDate(value: unknown): Date | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// ── GET: List all puzzles + categories ──────────────────────────────────

export async function GET() {
  const { error: authErr } = await requireRole('ADMIN');
  if (authErr) return authErr;

  try {
    const puzzles = await db.crosswordPuzzle.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        puzzleNumber: true,
        title: true,
        difficulty: true,
        language: true,
        categoryId: true,
        packId: true,
        rows: true,
        cols: true,
        publishDate: true,
        firstPublishedAt: true,
        published: true,
        isPremium: true,
        unlockCost: true,
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
      puzzleNumber: p.puzzleNumber,
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
      isPremium: p.isPremium,
      unlockCost: p.unlockCost,
      rows: p.rows,
      cols: p.cols,
      publishDate: p.publishDate?.toISOString() ?? null,
      firstPublishedAt: p.firstPublishedAt?.toISOString() ?? null,
      published: p.published,
      createdAt: p.createdAt.toISOString(),
    }));

    const schedule = await db.publishingSchedule.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const scheduleSettings = schedule
      ? { puzzlesPerDay: schedule.puzzlesPerDay, isActive: schedule.isActive }
      : { puzzlesPerDay: 1, isActive: true };

    const categories = await db.category.findMany({
      orderBy: [{ language: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { puzzles: true } } },
    });

    const packs = await db.pack.findMany({
      orderBy: [{ language: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { puzzles: true } } },
    });

    return NextResponse.json({
      puzzles: puzzleList,
      schedule: scheduleSettings,
      categories,
      packs,
    });
  } catch (error) {
    console.error('Error fetching admin puzzles:', error);
    return NextResponse.json({ error: 'Failed to fetch puzzles' }, { status: 500 });
  }
}

// ── POST: Create a new puzzle ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { error: authErr, session } = await requireRole('CREATOR');
  if (authErr) return authErr;

  try {
    const body = await request.json();

    if (!validateBody(body)) {
      return NextResponse.json(
        { error: 'Données invalides: titre, difficulté, grille et mots requis' },
        { status: 400 }
      );
    }

    const language = ['fr', 'en'].includes(body.language ?? '') ? body.language! : 'fr';
    const categoryId = body.categoryId || null;
    const packId = body.packId || null;
    const isPremium = body.isPremium === true;
    const requestedUnlockCost = body.unlockCost ?? 0;
    const unlockCost = isPremium && Number.isInteger(requestedUnlockCost) && requestedUnlockCost > 0
      ? requestedUnlockCost
      : 0;
    if (isPremium && unlockCost <= 0) {
      return NextResponse.json({ error: 'Le coût de déverrouillage doit être positif' }, { status: 400 });
    }

    // Validate categoryId if provided
    if (categoryId) {
      const cat = await db.category.findUnique({ where: { id: categoryId } });
      if (!cat) {
        return NextResponse.json({ error: 'Catégorie introuvable' }, { status: 400 });
      }
    }
    // Validate packId if provided
    if (packId) {
      const pack = await db.pack.findUnique({ where: { id: packId } });
      if (!pack) {
        return NextResponse.json({ error: 'Pack introuvable' }, { status: 400 });
      }
    }

    const requestedPublishDate = parsePublishDate(body.publishDate);
    if (requestedPublishDate === undefined) {
      return NextResponse.json({ error: 'Date de publication invalide' }, { status: 400 });
    }
    const isAdmin = session!.user.role === 'ADMIN';
    if (!isAdmin && (body.published === true || requestedPublishDate)) {
      return NextResponse.json({ error: 'Seul un administrateur peut publier ou programmer un puzzle' }, { status: 403 });
    }

    const dbFormat = puzzleToDbFormat({
      title: '',
      description: body.description,
      difficulty: body.difficulty,
      rows: body.rows,
      cols: body.cols,
      grid: body.grid,
      words: body.words,
      clues: body.clues,
    });

    const published = isAdmin && body.published === true;
    const puzzle = await createWithNextPuzzleNumber((tx, puzzleNumber) => {
      const autoTitle = formatPuzzleTitle(puzzleNumber);
      return tx.crosswordPuzzle.create({ data: {
        puzzleNumber,
        title: autoTitle,
        description: body.description?.trim() || null,
        difficulty: body.difficulty,
        language,
        categoryId,
        packId,
        isPremium,
        unlockCost,
        creatorId: session!.user.id,
        rows: body.rows,
        cols: body.cols,
        gridData: dbFormat.gridData,
        wordsData: dbFormat.wordsData,
        cluesData: dbFormat.cluesData,
        published,
        publishDate: requestedPublishDate,
        firstPublishedAt: published ? new Date() : null,
      }});
    });

    return NextResponse.json({ puzzle: { id: puzzle.id } }, { status: 201 });
  } catch (error) {
    console.error('Error creating puzzle:', error);
    return NextResponse.json({ error: 'Échec de la création du puzzle' }, { status: 500 });
  }
}

// ── PUT: Update an existing puzzle ───────────────────────────────────────

export async function PUT(request: NextRequest) {
  const { error: authErr, session } = await requireRole('CREATOR');
  if (authErr) return authErr;

  try {
    const body = await request.json();

    if (!body.id || typeof body.id !== 'string') {
      return NextResponse.json({ error: 'ID du puzzle requis' }, { status: 400 });
    }

    const existing = await db.crosswordPuzzle.findUnique({ where: { id: body.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Puzzle introuvable' }, { status: 404 });
    }
    if (session!.user.role !== 'ADMIN' && existing.creatorId !== session!.user.id) {
      return NextResponse.json({ error: 'Vous ne pouvez modifier que vos propres puzzles' }, { status: 403 });
    }

    // If grid data is provided, validate the full puzzle body
    const puzzleId = body.id;
    if (body.grid) {
      if (!validateBody(body)) {
        return NextResponse.json(
          { error: 'Données invalides' },
          { status: 400 }
        );
      }

      const dbFormat = puzzleToDbFormat({
        title: existing.title, // Keep auto-generated title
        description: body.description,
        difficulty: body.difficulty,
        rows: body.rows,
        cols: body.cols,
        grid: body.grid,
        words: body.words,
        clues: body.clues,
      });

      const language = ['fr', 'en'].includes(body.language ?? '') ? body.language! : existing.language;
      const categoryId = body.categoryId !== undefined ? (body.categoryId || null) : existing.categoryId;
      const packId = body.packId !== undefined ? (body.packId || null) : existing.packId;
      const isPremium = body.isPremium !== undefined ? body.isPremium === true : existing.isPremium;
      const requestedUnlockCost = body.unlockCost ?? 0;
      const unlockCost = isPremium
        ? (Number.isInteger(requestedUnlockCost) && requestedUnlockCost > 0 ? requestedUnlockCost : existing.unlockCost)
        : 0;
      if (isPremium && unlockCost <= 0) {
        return NextResponse.json({ error: 'Le coût de déverrouillage doit être positif' }, { status: 400 });
      }

      // Validate categoryId if provided
      if (categoryId) {
        const cat = await db.category.findUnique({ where: { id: categoryId } });
        if (!cat) {
          return NextResponse.json({ error: 'Catégorie introuvable' }, { status: 400 });
        }
      }
      // Validate packId if provided
      if (packId) {
        const pack = await db.pack.findUnique({ where: { id: packId } });
        if (!pack) {
          return NextResponse.json({ error: 'Pack introuvable' }, { status: 400 });
        }
      }

      await db.crosswordPuzzle.update({
        where: { id: puzzleId },
        data: {
          description: body.description?.trim() || null,
          difficulty: body.difficulty,
          language,
          categoryId,
          packId,
          isPremium,
          unlockCost,
          rows: body.rows,
          cols: body.cols,
          gridData: dbFormat.gridData,
          wordsData: dbFormat.wordsData,
          cluesData: dbFormat.cluesData,
        },
      });
    } else {
      // Only metadata update (description, difficulty, language, categoryId) — title is auto-managed
      const updateData: Record<string, unknown> = {};
      if (body.description !== undefined) updateData.description = body.description?.trim() || null;
      if (body.difficulty !== undefined) {
        if (!Number.isInteger(body.difficulty) || body.difficulty < 1 || body.difficulty > 3) {
          return NextResponse.json({ error: 'Difficulté invalide' }, { status: 400 });
        }
        updateData.difficulty = body.difficulty;
      }
      if (body.language && ['fr', 'en'].includes(body.language)) updateData.language = body.language;
      if (body.categoryId !== undefined) {
        if (body.categoryId) {
          const cat = await db.category.findUnique({ where: { id: body.categoryId } });
          if (!cat) {
            return NextResponse.json({ error: 'Catégorie introuvable' }, { status: 400 });
          }
          updateData.categoryId = body.categoryId;
        } else {
          updateData.categoryId = null;
        }
      }
      if (body.packId !== undefined) {
        if (body.packId) {
          const pack = await db.pack.findUnique({ where: { id: body.packId } });
          if (!pack) return NextResponse.json({ error: 'Pack introuvable' }, { status: 400 });
          updateData.packId = body.packId;
        } else {
          updateData.packId = null;
        }
      }
      if (body.isPremium !== undefined || body.unlockCost !== undefined) {
        const isPremium = body.isPremium !== undefined ? body.isPremium === true : existing.isPremium;
        const requestedUnlockCost = body.unlockCost ?? 0;
        const unlockCost = isPremium
          ? (Number.isInteger(requestedUnlockCost) && requestedUnlockCost > 0 ? requestedUnlockCost : existing.unlockCost)
          : 0;
        if (isPremium && unlockCost <= 0) {
          return NextResponse.json({ error: 'Le coût de déverrouillage doit être positif' }, { status: 400 });
        }
        updateData.isPremium = isPremium;
        updateData.unlockCost = unlockCost;
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'Aucune modification fournie' }, { status: 400 });
      }

      await db.crosswordPuzzle.update({
        where: { id: body.id },
        data: updateData,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating puzzle:', error);
    return NextResponse.json({ error: 'Échec de la mise à jour' }, { status: 500 });
  }
}

// ── DELETE: Delete a puzzle ────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const { error: authErr } = await requireRole('ADMIN');
  if (authErr) return authErr;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await db.crosswordPuzzle.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Puzzle introuvable' }, { status: 404 });
    }

    // Delete related progress first
    await db.userProgress.deleteMany({ where: { puzzleId: id } });
    await db.crosswordPuzzle.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting puzzle:', error);
    return NextResponse.json({ error: 'Échec de la suppression' }, { status: 500 });
  }
}
