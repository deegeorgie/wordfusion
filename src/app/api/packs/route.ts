import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth-guard';

// ── GET: List all packs ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const language = searchParams.get('language');

    const where = language ? { language } : {};

    const packs = await db.pack.findMany({
      where,
      orderBy: [{ language: 'asc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { puzzles: true } },
      },
    });

    return NextResponse.json({ packs });
  } catch (error) {
    console.error('Error fetching packs:', error);
    return NextResponse.json({ error: 'Failed to fetch packs' }, { status: 500 });
  }
}

// ── POST: Create a new pack ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { error: authErr } = await requireRole('ADMIN');
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const { name, description, icon = '📦', language = 'fr' } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Nom du pack requis' }, { status: 400 });
    }

    if (!['fr', 'en'].includes(language)) {
      return NextResponse.json({ error: 'Langue invalide (fr ou en)' }, { status: 400 });
    }

    const pack = await db.pack.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon.trim().slice(0, 4) || '📦',
        language,
      },
    });

    return NextResponse.json({ pack }, { status: 201 });
  } catch (error) {
    console.error('Error creating pack:', error);
    return NextResponse.json({ error: 'Échec de la création du pack' }, { status: 500 });
  }
}

// ── PUT: Update a pack ──────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  const { error: authErr } = await requireRole('ADMIN');
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const { id, name, description, icon, language } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await db.pack.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Pack introuvable' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined && typeof name === 'string' && name.trim().length > 0) {
      updateData.name = name.trim();
    }
    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }
    if (icon !== undefined && typeof icon === 'string') {
      updateData.icon = icon.trim().slice(0, 4) || '📦';
    }
    if (language !== undefined && ['fr', 'en'].includes(language)) {
      updateData.language = language;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune modification fournie' }, { status: 400 });
    }

    const pack = await db.pack.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ pack });
  } catch (error) {
    console.error('Error updating pack:', error);
    return NextResponse.json({ error: 'Échec de la mise à jour' }, { status: 500 });
  }
}

// ── DELETE: Delete a pack ─────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const { error: authErr } = await requireRole('ADMIN');
  if (authErr) return authErr;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await db.pack.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Pack introuvable' }, { status: 404 });
    }

    await db.pack.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting pack:', error);
    return NextResponse.json({ error: 'Échec de la suppression' }, { status: 500 });
  }
}
