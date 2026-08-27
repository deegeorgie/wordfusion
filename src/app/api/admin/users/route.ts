import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/admin/users?search=... — list users (admin only)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';

    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
            { city: { contains: search } },
            { country: { contains: search } },
          ],
        }
      : {};

    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        provider: true,
        phone: true,
        dateOfBirth: true,
        gender: true,
        country: true,
        city: true,
        occupation: true,
        education: true,
        createdAt: true,
        _count: { select: { puzzles: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('[admin/users GET]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH /api/admin/users — update role or delete user (admin only)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const body = await req.json();
    const { action, userId, role } = body;

    if (!userId || !action) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Prevent self-demotion / self-deletion
    if (userId === session.user.id) {
      return NextResponse.json({ error: 'Impossible de modifier votre propre compte' }, { status: 400 });
    }

    if (action === 'updateRole') {
      if (!role || !['USER', 'CREATOR', 'ADMIN'].includes(role)) {
        return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 });
      }
      await db.user.update({ where: { id: userId }, data: { role } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete') {
      await db.userProgress.deleteMany({ where: { userId } });
      await db.user.delete({ where: { id: userId } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
  } catch (error) {
    console.error('[admin/users PATCH]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
