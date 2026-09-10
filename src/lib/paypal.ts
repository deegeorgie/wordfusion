import { db } from '@/lib/db';

export const COIN_PRODUCTS = {
  starter: { key: 'starter', coins: 100, amountMinor: 99, currency: 'USD' },
  standard: { key: 'standard', coins: 350, amountMinor: 299, currency: 'USD' },
  value: { key: 'value', coins: 700, amountMinor: 499, currency: 'USD' },
  large: { key: 'large', coins: 1600, amountMinor: 999, currency: 'USD' },
} as const;

export type CoinProductKey = keyof typeof COIN_PRODUCTS;

type PayPalResponse = Record<string, unknown>;

function getPayPalBaseUrl(): string {
  return process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

function getRequiredEnv(name: 'PAYPAL_CLIENT_ID' | 'PAYPAL_CLIENT_SECRET'): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function getAccessToken(): Promise<string> {
  const credentials = Buffer.from(
    `${getRequiredEnv('PAYPAL_CLIENT_ID')}:${getRequiredEnv('PAYPAL_CLIENT_SECRET')}`,
  ).toString('base64');

  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`PayPal token request failed (${response.status})`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('PayPal access token was missing');
  return data.access_token;
}

export function getCoinProduct(productKey: unknown) {
  if (typeof productKey !== 'string') return null;
  return COIN_PRODUCTS[productKey as CoinProductKey] ?? null;
}

export async function createPayPalCoinOrder(input: {
  productKey: CoinProductKey;
  purchaseId: string;
  userId: string;
}): Promise<{ orderId: string; approvalUrl: string }> {
  const product = COIN_PRODUCTS[input.productKey];
  const token = await getAccessToken();
  const response = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: input.purchaseId,
        custom_id: input.userId,
        description: `${product.coins} WordFusion coins`,
        amount: {
          currency_code: product.currency,
          value: (product.amountMinor / 100).toFixed(2),
        },
      }],
      application_context: {
        user_action: 'PAY_NOW',
        return_url: `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/payment/paypal/success`,
        cancel_url: `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/payment/paypal/cancel`,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`PayPal order creation failed (${response.status})`);
  }

  const data = (await response.json()) as PayPalResponse & {
    id?: string;
    links?: { rel?: string; href?: string }[];
  };
  const approvalUrl = data.links?.find((link) => link.rel === 'approve')?.href;
  if (!data.id || !approvalUrl) throw new Error('PayPal approval URL was missing');
  return { orderId: data.id, approvalUrl };
}

export async function capturePayPalOrder(orderId: string): Promise<PayPalResponse> {
  const token = await getAccessToken();
  const response = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: '{}',
  });

  if (!response.ok) {
    throw new Error(`PayPal capture failed (${response.status})`);
  }
  return (await response.json()) as PayPalResponse;
}

export async function creditCapturedCoinPurchase(orderId: string) {
  return db.$transaction(async (tx) => {
    const purchase = await tx.paymentPurchase.findUnique({
      where: { providerOrderId: orderId },
    });
    if (!purchase) throw new Error('Payment purchase not found');
    if (purchase.status === 'COMPLETED') return { purchase, credited: false };

    const wallet = await tx.userWallet.upsert({
      where: { userId: purchase.userId },
      create: { userId: purchase.userId, balance: purchase.coins },
      update: { balance: { increment: purchase.coins } },
    });
    const updatedPurchase = await tx.paymentPurchase.update({
      where: { id: purchase.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    await tx.coinTransaction.create({
      data: {
        userId: purchase.userId,
        walletId: wallet.id,
        amount: purchase.coins,
        reason: 'paypal_coin_purchase',
        referenceKey: `paypal-purchase:${purchase.id}`,
        balanceAfter: wallet.balance,
      },
    });
    return { purchase: updatedPurchase, credited: true };
  });
}
