import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { capturePayPalOrder, creditCapturedCoinPurchase } from '@/lib/paypal';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  try {
    const { orderId } = await params;
    const purchase = await db.paymentPurchase.findUnique({
      where: { providerOrderId: orderId },
      select: { userId: true, status: true },
    });
    if (!purchase || purchase.userId !== session!.user.id) {
      return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 });
    }
    if (purchase.status === 'COMPLETED') {
      return NextResponse.json({ completed: true, alreadyProcessed: true });
    }

    const capture = await capturePayPalOrder(orderId);
    if (capture.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Le paiement PayPal n’est pas confirmé' }, { status: 402 });
    }

    const result = await creditCapturedCoinPurchase(orderId);
    return NextResponse.json({ completed: true, credited: result.credited });
  } catch (error) {
    console.error('Error capturing PayPal order:', error);
    return NextResponse.json({ error: 'Impossible de confirmer le paiement PayPal' }, { status: 500 });
  }
}
