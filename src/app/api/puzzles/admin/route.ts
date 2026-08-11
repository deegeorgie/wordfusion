import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { puzzleToDbFormat } from '@/lib/crossword/utils';
import type { CrosswordPuzzleData } from '@/lib/crossword/types';

// ── Types ─────────────────────────────────────────────────────────────

interface PuzzleBody {
  title: string;
  description?: string;
  difficulty: number;
  language?: string;
  categoryId?: string | null;
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
    typeof b.title === 'string' && b.title.trim().length > 0 &&
    typeof b.difficulty === 'number' && b.difficulty >= 1 && b.difficulty <= 3 &&
    typeof b.rows === 'number' && b.rows >= 2 &&
    typeof b.cols === 'number' && b.cols >= 2 &&
    Array.isArray(b.grid) && Array.isArray(b.words) && Array.isArray(b.clues)
  );
}

// ── GET: List all puzzles + categories ──────────────────────────────────

export async function GET() {
  try {
    const puzzles = await db.crosswordPuzzle.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        difficulty: true,
        language: true,
        categoryId: true,
        rows: true,
        cols: true,
        publishDate: true,
        published: true,
        createdAt: true,
        category: {
          select: { id: true, name: true, slug: true },
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
      rows: p.rows,
      cols: p.cols,
      publishDate: p.publishDate?.toISOString() ?? null,
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

    return NextResponse.json({
      puzzles: puzzleList,
      schedule: scheduleSettings,
      categories,
    });
  } catch (error) {
    console.error('Error fetching admin puzzles:', error);
    return NextResponse.json({ error: 'Failed to fetch puzzles' }, { status: 500 });
  }
}

// ── POST: Create a new puzzle ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!validateBody(body)) {
      return NextResponse.json(
        { error: 'Données invalides: titre, difficulté, grille et mots requis' },
        { status: 400 }
      );
    }

    const language = ['fr', 'en'].includes(body.language) ? body.language : 'fr';
    const categoryId = body.categoryId || null;

    // Validate categoryId if provided
    if (categoryId) {
      const cat = await db.category.findUnique({ where: { id: categoryId } });
      if (!cat) {
        return NextResponse.json({ error: 'Catégorie introuvable' }, { status: 400 });
      }
    }

    const dbFormat = puzzleToDbFormat({
      title: body.title,
      description: body.description,
      difficulty: body.difficulty,
      rows: body.rows,
      cols: body.cols,
      grid: body.grid,
      words: body.words,
      clues: body.clues,
    });

    const puzzle = await db.crosswordPuzzle.create({
      data: {
        title: body.title.trim(),
        description: body.description?.trim() || null,
        difficulty: body.difficulty,
        language,
        categoryId,
        rows: body.rows,
        cols: body.cols,
        gridData: dbFormat.gridData,
        wordsData: dbFormat.wordsData,
        cluesData: dbFormat.cluesData,
        published: body.published ?? false,
        publishDate: body.publishDate ? new Date(body.publishDate) : null,
      },
    });

    return NextResponse.json({ puzzle: { id: puzzle.id } }, { status: 201 });
  } catch (error) {
    console.error('Error creating puzzle:', error);
    return NextResponse.json({ error: 'Échec de la création du puzzle' }, { status: 500 });
  }
}

// ── PUT: Update an existing puzzle ───────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id || typeof body.id !== 'string') {
      return NextResponse.json({ error: 'ID du puzzle requis' }, { status: 400 });
    }

    const existing = await db.crosswordPuzzle.findUnique({ where: { id: body.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Puzzle introuvable' }, { status: 404 });
    }

    // If grid data is provided, validate the full puzzle body
    if (body.grid) {
      if (!validateBody(body)) {
        return NextResponse.json(
          { error: 'Données invalides' },
          { status: 400 }
        );
      }

      const dbFormat = puzzleToDbFormat({
        title: body.title,
        description: body.description,
        difficulty: body.difficulty,
        rows: body.rows,
        cols: body.cols,
        grid: body.grid,
        words: body.words,
        clues: body.clues,
      });

      const language = ['fr', 'en'].includes(body.language) ? body.language : existing.language;
      const categoryId = body.categoryId !== undefined ? (body.categoryId || null) : existing.categoryId;

      // Validate categoryId if provided
      if (categoryId) {
        const cat = await db.category.findUnique({ where: { id: categoryId } });
        if (!cat) {
          return NextResponse.json({ error: 'Catégorie introuvable' }, { status: 400 });
        }
      }

      await db.crosswordPuzzle.update({
        where: { id: body.id },
        data: {
          title: body.title.trim(),
          description: body.description?.trim() || null,
          difficulty: body.difficulty,
          language,
          categoryId,
          rows: body.rows,
          cols: body.cols,
          gridData: dbFormat.gridData,
          wordsData: dbFormat.wordsData,
          cluesData: dbFormat.cluesData,
        },
      });
    } else {
      // Only metadata update (title, description, difficulty, language, categoryId)
      const updateData: Record<string, unknown> = {};
      if (body.title) updateData.title = body.title.trim();
      if (body.description !== undefined) updateData.description = body.description?.trim() || null;
      if (body.difficulty) updateData.difficulty = body.difficulty;
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
