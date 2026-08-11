import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── GET: List all categories ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const language = searchParams.get('language');

    const where = language ? { language } : {};

    const categories = await db.category.findMany({
      where,
      orderBy: [{ language: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { puzzles: true } },
      },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

// ── POST: Create a new category ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, language = 'fr' } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Nom de catégorie requis' }, { status: 400 });
    }

    if (!['fr', 'en'].includes(language)) {
      return NextResponse.json({ error: 'Langue invalide (fr ou en)' }, { status: 400 });
    }

    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    if (!slug) {
      return NextResponse.json({ error: 'Nom invalide pour générer un slug' }, { status: 400 });
    }

    const category = await db.category.create({
      data: {
        name: name.trim(),
        slug,
        language,
      },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('Unique')) {
      return NextResponse.json({ error: 'Une catégorie avec ce nom existe déjà' }, { status: 409 });
    }
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Échec de la création de la catégorie' }, { status: 500 });
  }
}

// ── PUT: Update a category ────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, language } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await db.category.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Catégorie introuvable' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined && typeof name === 'string' && name.trim().length > 0) {
      updateData.name = name.trim();
      updateData.slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    if (language !== undefined && ['fr', 'en'].includes(language)) {
      updateData.language = language;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune modification fournie' }, { status: 400 });
    }

    const category = await db.category.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ category });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('Unique')) {
      return NextResponse.json({ error: 'Une catégorie avec ce nom existe déjà' }, { status: 409 });
    }
    console.error('Error updating category:', error);
    return NextResponse.json({ error: 'Échec de la mise à jour' }, { status: 500 });
  }
}

// ── DELETE: Delete a category ──────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await db.category.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Catégorie introuvable' }, { status: 404 });
    }

    // Deleting category will set categoryId to null on related puzzles (onDelete: SetNull)
    await db.category.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Échec de la suppression' }, { status: 500 });
  }
}
