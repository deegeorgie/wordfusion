import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { grantChariowEntitlements } from '@/lib/chariow-grants';
import { issueEmailVerification } from '@/lib/email-verification';
import { normalizeEmail } from '@/lib/verification-token';
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

  const rawEmail = getCharioUserEmail(payload);
  if (!rawEmail) {
    return NextResponse.json({ error: 'Missing customer email' }, { status: 400 });
  }
  const email = normalizeEmail(rawEmail);

  const user = await db.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, name: true, email: true, emailVerified: true },
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

  let purchaseId: string | null = null;
  let purchaseAlreadyCompleted = false;
  let requiresVerification = !user.emailVerified;

  await db.$transaction(async (tx) => {
    await tx.chariowPulseDelivery.create({
      data: { id: deliveryId, saleId: providerOrderId },
    });

    const existingPurchase = await tx.paymentPurchase.findFirst({
      where: { provider: 'CHARIO', providerOrderId },
    });
    if (existingPurchase?.status === 'COMPLETED') {
      purchaseAlreadyCompleted = true;
      return;
    }

    // Re-read inside the transaction so a verification that landed a moment
    // ago is not overwritten by a purchase held for verification.
    const freshUser = await tx.user.findUnique({
      where: { id: user.id },
      select: { emailVerified: true },
    });
    requiresVerification = !freshUser?.emailVerified;

    const purchase = existingPurchase
      ? await tx.paymentPurchase.update({
          where: { id: existingPurchase.id },
          data: {
            productType: product.kind.toUpperCase(),
            productKey: product.key,
            coins: product.coins ?? existingPurchase.coins,
            amountMinor: product.amountMinor ?? existingPurchase.amountMinor,
            currency: product.currency ?? existingPurchase.currency,
            status: requiresVerification ? 'PENDING_VERIFICATION' : 'PENDING',
            completedAt: null,
          },
        })
      : await tx.paymentPurchase.create({
          data: {
            userId: user.id,
            provider: 'CHARIO',
            providerOrderId,
            productType: product.kind.toUpperCase(),
            productKey: product.key,
            coins: product.coins ?? 0,
            amountMinor: product.amountMinor ?? 0,
            currency: product.currency ?? 'XOF',
            status: requiresVerification ? 'PENDING_VERIFICATION' : 'PENDING',
          },
        });

    purchaseId = purchase.id;

    if (!requiresVerification) {
      await grantChariowEntitlements(tx, {
        userId: user.id,
        purchaseId: purchase.id,
        product,
        providerOrderId,
      });
    }
  });

  if (purchaseAlreadyCompleted || !purchaseId) {
    return NextResponse.json({ ok: true });
  }

  if (requiresVerification) {
    const { sent } = await issueEmailVerification(user, 'purchase_claim');
    console.warn(
      `[chario] Purchase ${providerOrderId} for ${user.email} is held until email verification; message ${sent ? 'sent' : 'not sent'}`,
    );
    return NextResponse.json({ ok: true, pendingVerification: true });
  }

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
