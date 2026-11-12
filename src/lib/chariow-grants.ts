import type { Prisma } from '@prisma/client';
import { addMonths, addYears } from 'date-fns';
import { db } from '@/lib/db';
import { getCharioProductById, type CharioProductDefinition } from '@/lib/chario';
import { isBiteSizedPuzzle } from '@/lib/puzzle-rules';

interface PurchaseGrantParams {
  userId: string;
  purchaseId: string;
  product: CharioProductDefinition;
  providerOrderId: string;
}

/**
 * Credits a Chariow purchase exactly once. The guarded status transition makes
 * webhook retries and claim-after-verification safe to run concurrently.
 */
export async function grantChariowEntitlements(
  tx: Prisma.TransactionClient,
  { userId, purchaseId, product, providerOrderId }: PurchaseGrantParams,
): Promise<boolean> {
  const claimed = await tx.paymentPurchase.updateMany({
    where: { id: purchaseId, status: { not: 'COMPLETED' } },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
  if (claimed.count !== 1) return false;

  if (product.kind === 'subscription' && product.planKey) {
    const now = new Date();
    const subscriptionId = `chariow:${userId}`;
    const currentSubscription = await tx.userSubscription.findFirst({
      where: {
        userId,
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
        userId,
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
        userId,
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
      where: { userId },
      create: { userId, balance: coinGrant },
      update: { balance: { increment: coinGrant } },
    });

    await tx.coinTransaction.create({
      data: {
        userId,
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
          where: { userId_puzzleId: { userId, puzzleId } },
          create: { userId, puzzleId },
          update: {},
        });
      }),
    );
  }

  return true;
}

/** Grants purchases that were held back until the buyer verified their email. */
export async function completePendingPurchases(userId: string): Promise<number> {
  const pending = await db.paymentPurchase.findMany({
    where: { userId, provider: 'CHARIO', status: 'PENDING_VERIFICATION' },
    select: { id: true, providerOrderId: true, productKey: true },
  });

  let completed = 0;
  for (const purchase of pending) {
    const providerOrderId = purchase.providerOrderId;
    if (!providerOrderId) continue;

    const product = getCharioProductById(purchase.productKey);
    if (!product) {
      console.error(`[chario] Unknown product "${purchase.productKey}" for purchase ${purchase.id}`);
      continue;
    }

    try {
      const granted = await db.$transaction((tx) => grantChariowEntitlements(tx, {
        userId,
        purchaseId: purchase.id,
        product,
        providerOrderId,
      }));
      if (granted) completed += 1;
    } catch (error) {
      console.error(`[chario] Could not complete pending purchase ${purchase.id}:`, error);
    }
  }

  return completed;
}
