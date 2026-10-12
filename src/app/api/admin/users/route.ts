import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
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

    const body: unknown = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
    }
    const payload = body as Record<string, unknown>;
    const { action, userId, role } = payload;

    if (typeof userId !== 'string' || !userId || typeof action !== 'string' || !action) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Prevent admins from changing their own role or privileges.
    if (userId === session.user.id) {
      return NextResponse.json({ error: 'Impossible de modifier votre propre compte' }, { status: 400 });
    }

    if (action === 'updateRole') {
      if (typeof role !== 'string' || !['USER', 'CREATOR', 'ADMIN'].includes(role)) {
        return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 });
      }
      await db.user.update({ where: { id: userId }, data: { role } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'grantCoins') {
      const amount = payload.amount;
      if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1 || amount > 1_000_000) {
        return NextResponse.json({ error: 'Le montant doit être compris entre 1 et 1 000 000 pièces' }, { status: 400 });
      }

      const result = await db.$transaction(async (tx) => {
        const wallet = await tx.userWallet.upsert({
          where: { userId },
          create: { userId, balance: amount },
          update: { balance: { increment: amount } },
        });
        await tx.coinTransaction.create({
          data: {
            userId,
            walletId: wallet.id,
            amount,
            reason: 'admin_grant',
            referenceKey: `admin-grant:${session.user.id}:${randomUUID()}`,
            balanceAfter: wallet.balance,
          },
        });
        return wallet;
      });

      return NextResponse.json({ ok: true, balance: result.balance });
    }

    if (action === 'grantSubscription') {
      const days = payload.days;
      if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 3650) {
        return NextResponse.json({ error: 'La durée doit être comprise entre 1 et 3 650 jours' }, { status: 400 });
      }

      const now = new Date();
      const providerSubscriptionId = `admin:${userId}`;
      const subscription = await db.$transaction(async (tx) => {
        const activeSubscription = await tx.userSubscription.findFirst({
          where: {
            userId,
            status: 'ACTIVE',
            currentPeriodEnd: { gt: now },
          },
          orderBy: { currentPeriodEnd: 'desc' },
          select: { currentPeriodEnd: true },
        });
        const currentPeriodEnd = new Date(
          Math.max(now.getTime(), activeSubscription?.currentPeriodEnd?.getTime() ?? now.getTime())
            + days * 24 * 60 * 60 * 1000,
        );

        return tx.userSubscription.upsert({
          where: { providerSubscriptionId },
          create: {
            userId,
            provider: 'ADMIN',
            providerSubscriptionId,
            planKey: 'premium_admin_grant',
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd,
          },
          update: {
            planKey: 'premium_admin_grant',
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd,
            cancelAtPeriodEnd: false,
          },
        });
      });

      return NextResponse.json({ ok: true, currentPeriodEnd: subscription.currentPeriodEnd });
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
