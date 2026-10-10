import { NextResponse } from 'next/server';
import { addMonths, addYears } from 'date-fns';
import { db } from '@/lib/db';
import { isBiteSizedPuzzle } from '@/lib/puzzle-rules';
import {
  CHARIO_PRODUCTS,
  getCharioOrderId,
  getCharioProductById,
  getCharioProductId,
  getCharioUserEmail,
  isSuccessfulCharioEvent,
  verifyCharioSignature,
} from '@/lib/chario';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-chariow-signature');

  if (!verifyCharioSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const testNote = typeof payload.note === 'string' &&
    payload.note.toLowerCase().includes('test sale for pulse testing');
  if (testNote) {
    return NextResponse.json({ ok: true, test: true });
  }

  const deliveryId = request.headers.get('x-pulse-delivery-id');
  if (!deliveryId) {
    if (request.headers.get('x-pulse-id') && request.headers.get('x-pulse-event')) {
      return NextResponse.json({ ok: true, test: true });
    }
    return NextResponse.json({ error: 'Missing pulse delivery ID' }, { status: 400 });
  }

  if (!isSuccessfulCharioEvent(payload)) {
    return NextResponse.json({ ok: true });
  }

  const productId = getCharioProductId(payload);
  const product = productId ? getCharioProductById(productId) : null;
  if (!product) {
    return NextResponse.json({ error: 'Unmapped Chariow product' }, { status: 422 });
  }

  const providerOrderId = getCharioOrderId(payload);
  if (!providerOrderId) {
    return NextResponse.json({ error: 'Missing sale ID' }, { status: 400 });
  }

  const email = getCharioUserEmail(payload);
  if (!email) {
    return NextResponse.json({ error: 'Missing customer email' }, { status: 400 });
  }

  const user = await db.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'No WordFusion account matches the customer email' }, { status: 404 });
  }

  const existingDelivery = await db.chariowPulseDelivery.findUnique({
    where: { id: deliveryId },
    select: { id: true },
  });
  if (existingDelivery) {
    return NextResponse.json({ ok: true });
  }

  await db.$transaction(async (tx) => {
    await tx.chariowPulseDelivery.create({
      data: { id: deliveryId, saleId: providerOrderId },
    });

    const existingPurchase = await tx.paymentPurchase.findFirst({
      where: { provider: 'CHARIO', providerOrderId },
    });
    if (existingPurchase?.status === 'COMPLETED') return;

    const purchase = existingPurchase ?? (await tx.paymentPurchase.create({
      data: {
        userId: user.id,
        provider: 'CHARIO',
        providerOrderId,
        productType: product.kind.toUpperCase(),
        productKey: product.key,
        coins: product.coins ?? 0,
        amountMinor: product.amountMinor ?? 0,
        currency: product.currency ?? 'XOF',
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    }));

    if (existingPurchase) {
      await tx.paymentPurchase.update({
        where: { id: purchase.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          productType: product.kind.toUpperCase(),
          productKey: product.key,
          coins: product.coins ?? purchase.coins,
          amountMinor: product.amountMinor ?? purchase.amountMinor,
          currency: product.currency ?? purchase.currency,
        },
      });
    }

    if (product.kind === 'subscription' && product.planKey) {
      const now = new Date();
      const subscriptionId = `chariow:${user.id}`;
      const currentSubscription = await tx.userSubscription.findFirst({
        where: {
          userId: user.id,
          provider: 'CHARIO',
          status: 'ACTIVE',
          currentPeriodEnd: { gt: now },
        },
        orderBy: { currentPeriodEnd: 'desc' },
      });
      const currentPeriodStart = currentSubscription?.currentPeriodEnd ?? now;
      const currentPeriodEnd = product.planKey === 'premium_annual'
        ? addYears(currentPeriodStart, 1)
        : addMonths(currentPeriodStart, 1);

      await tx.userSubscription.updateMany({
        where: {
          userId: user.id,
          provider: 'CHARIO',
          status: 'ACTIVE',
          providerSubscriptionId: { not: subscriptionId },
        },
        data: { status: 'REPLACED' },
      });

      await tx.userSubscription.upsert({
        where: { providerSubscriptionId: subscriptionId },
        update: {
          planKey: product.planKey,
          status: 'ACTIVE',
          currentPeriodStart: currentSubscription?.currentPeriodStart ?? now,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
        },
        create: {
          userId: user.id,
          provider: 'CHARIO',
          providerSubscriptionId: subscriptionId,
          planKey: product.planKey,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
        },
      });
    }

    if ((product.kind === 'coin_bundle' || product.kind === 'bundle') && (product.coins ?? 0) > 0) {
      const coinGrant = product.coins ?? 0;
      const wallet = await tx.userWallet.upsert({
        where: { userId: user.id },
        create: { userId: user.id, balance: coinGrant },
        update: { balance: { increment: coinGrant } },
      });

      await tx.coinTransaction.create({
        data: {
          userId: user.id,
          walletId: wallet.id,
          amount: coinGrant,
          reason: product.kind === 'bundle' ? 'chario_starter_bundle' : 'chario_coin_bundle',
          referenceKey: `chario:${providerOrderId}:${product.key}`,
          balanceAfter: wallet.balance,
        },
      });
    }

    if (product.kind === 'bundle') {
      const puzzleCandidates = product.puzzleIds?.length
        ? await tx.crosswordPuzzle.findMany({
            where: { id: { in: product.puzzleIds }, published: true, isPremium: true },
            select: { id: true, rows: true, cols: true },
          })
        : await tx.crosswordPuzzle.findMany({
            where: { published: true, isPremium: true },
            orderBy: { createdAt: 'asc' },
            select: { id: true, rows: true, cols: true },
          });
      const puzzlesToUnlock = puzzleCandidates.filter((puzzle) => !isBiteSizedPuzzle(puzzle)).slice(0, 3);
      if (puzzlesToUnlock.length < 3) {
        throw new Error('Starter bundle requires three published premium puzzles');
      }

      await Promise.all(
        puzzlesToUnlock.map(async ({ id: puzzleId }) => {
          await tx.puzzleUnlock.upsert({
            where: { userId_puzzleId: { userId: user.id, puzzleId } },
            create: { userId: user.id, puzzleId },
            update: {},
          });
        }),
      );
    }
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    configuredProducts: Object.fromEntries(
      Object.values(CHARIO_PRODUCTS).map(({ key, id }) => [key, id]),
    ),
  });
}
