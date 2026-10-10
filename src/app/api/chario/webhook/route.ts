import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
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
    return NextResponse.json({ ok: true });
  }

  const providerOrderId = getCharioOrderId(payload);
  if (!providerOrderId) {
    return NextResponse.json({ error: 'Missing sale ID' }, { status: 400 });
  }

  const email = getCharioUserEmail(payload);
  if (!email) {
    return NextResponse.json({ error: 'Missing customer email' }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ ok: true });
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
        currency: product.currency ?? 'USD',
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
      const subscriptionId = providerOrderId;
      await tx.userSubscription.upsert({
        where: { providerSubscriptionId: subscriptionId },
        update: {
          planKey: product.planKey,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
        },
        create: {
          userId: user.id,
          provider: 'CHARIO',
          providerSubscriptionId: subscriptionId,
          planKey: product.planKey,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
        },
      });
    }

    if (product.kind === 'coin_bundle') {
      const coinGrant = product.coins ?? 0;
      if (coinGrant > 0) {
        const wallet = await tx.userWallet.upsert({
          where: { userId: user.id },
          create: { userId: user.id, balance: 0 },
          update: {},
        });

        const nextBalance = wallet.balance + coinGrant;
        await tx.userWallet.update({
          where: { userId: user.id },
          data: { balance: nextBalance },
        });

        await tx.coinTransaction.create({
          data: {
            userId: user.id,
            walletId: wallet.id,
            amount: coinGrant,
            reason: 'chario_coin_bundle',
            referenceKey: `chario:${providerOrderId}:${product.key}`,
            balanceAfter: nextBalance,
          },
        });
      }
    }

    if (product.kind === 'bundle' && product.puzzleIds && product.puzzleIds.length > 0) {
      await Promise.all(
        product.puzzleIds.map(async (puzzleId) => {
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
