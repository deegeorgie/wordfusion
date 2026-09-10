import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { createPayPalCoinOrder, getCoinProduct, type CoinProductKey } from '@/lib/paypal';

export async function POST(request: Request) {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  try {
    const body = (await request.json()) as { productKey?: unknown };
    const product = getCoinProduct(body.productKey);
    if (!product) {
      return NextResponse.json({ error: 'Pack de pièces invalide' }, { status: 400 });
    }

    const purchase = await db.paymentPurchase.create({
      data: {
        userId: session!.user.id,
        provider: 'PAYPAL',
        productType: 'COIN_BUNDLE',
        productKey: product.key,
        coins: product.coins,
        amountMinor: product.amountMinor,
        currency: product.currency,
      },
    });

    try {
      const order = await createPayPalCoinOrder({
        productKey: product.key as CoinProductKey,
        purchaseId: purchase.id,
        userId: session!.user.id,
      });
      await db.paymentPurchase.update({
        where: { id: purchase.id },
        data: { providerOrderId: order.orderId },
      });
      return NextResponse.json({
        purchaseId: purchase.id,
        orderId: order.orderId,
        approvalUrl: order.approvalUrl,
      }, { status: 201 });
    } catch (error) {
      await db.paymentPurchase.update({
        where: { id: purchase.id },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  } catch (error) {
    console.error('Error creating PayPal order:', error);
    return NextResponse.json({ error: 'Impossible de créer le paiement PayPal' }, { status: 500 });
  }
}
