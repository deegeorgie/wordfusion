import { createHmac, timingSafeEqual } from 'node:crypto';

export type CharioProductKind = 'subscription' | 'coin_bundle' | 'bundle';

export type CharioProductDefinition = {
  id: string;
  key: string;
  kind: CharioProductKind;
  label: string;
  amountMinor?: number;
  currency?: string;
  coins?: number;
  planKey?: string;
  puzzleIds?: string[];
};

function getProductId(...values: (string | undefined)[]): string {
  return values.find((value) => value?.trim())?.trim() ?? '';
}

const envProductIds = {
  premium_monthly: getProductId(
    process.env.PREMIUM_MONTHLY_PRODUCT_ID,
    process.env.CHARIO_PRODUCT_PREMIUM_MONTHLY,
    'premium_monthly',
  ),
  premium_annual: getProductId(
    process.env.PREMIUM_ANNUAL_PRODUCT_ID,
    process.env.CHARIO_PRODUCT_PREMIUM_ANNUAL,
    'premium_annual',
  ),
  coin_500: getProductId(
    process.env.COINS500_PRODUCT_ID,
    process.env['500_COINS_PRODUCT_ID'],
    process.env.CHARIO_PRODUCT_COIN_500,
    'coin_500',
  ),
  bundle_starter: getProductId(
    process.env.STARTER_BUNDLE_PRODUCT_ID,
    process.env.CHARIO_PRODUCT_BUNDLE_STARTER,
    'bundle_starter',
  ),
} as const;

export const CHARIO_PRODUCTS: Record<string, CharioProductDefinition> = {
  [envProductIds.premium_monthly]: {
    id: envProductIds.premium_monthly,
    key: 'premium_monthly',
    kind: 'subscription',
    label: 'Premium monthly',
    amountMinor: 2500,
    currency: 'XOF',
    planKey: 'premium_monthly',
  },
  [envProductIds.premium_annual]: {
    id: envProductIds.premium_annual,
    key: 'premium_annual',
    kind: 'subscription',
    label: 'Premium annual',
    amountMinor: 20000,
    currency: 'XOF',
    planKey: 'premium_annual',
  },
  [envProductIds.coin_500]: {
    id: envProductIds.coin_500,
    key: 'coin_500',
    kind: 'coin_bundle',
    label: '500 coins',
    amountMinor: 1500,
    currency: 'XOF',
    coins: 500,
  },
  [envProductIds.bundle_starter]: {
    id: envProductIds.bundle_starter,
    key: 'bundle_starter',
    kind: 'bundle',
    label: 'Starter bundle',
    amountMinor: 3000,
    currency: 'XOF',
    coins: 150,
    puzzleIds: [],
  },
};

export function getCharioWebhookSecret(): string | undefined {
  return process.env.CHARIOW_PULSE_SECRET;
}

export function getCharioProductById(productId?: string | null): CharioProductDefinition | null {
  if (!productId) return null;

  const directMatch = CHARIO_PRODUCTS[productId];
  if (directMatch) return directMatch;

  const normalized = productId.toLowerCase();
  return Object.values(CHARIO_PRODUCTS).find((product) => {
    return (
      product.id.toLowerCase() === normalized ||
      product.key.toLowerCase() === normalized ||
      product.label.toLowerCase() === normalized
    );
  }) ?? null;
}

export function verifyCharioSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = getCharioWebhookSecret();
  if (!secret) return false;
  if (!signatureHeader?.startsWith('sha256=')) return false;

  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const receivedBuffer = Buffer.from(signatureHeader, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function isSuccessfulCharioEvent(payload: Record<string, unknown>): boolean {
  const data = payload as {
    event?: unknown;
    sale?: { status?: unknown };
  };
  return data.event === 'successful.sale' &&
    String(data.sale?.status ?? '').toLowerCase() === 'completed';
}

export function getCharioProductId(payload: Record<string, unknown>): string | null {
  const data = payload as {
    product?: { id?: unknown };
  };
  const candidates = [
    data?.product?.id,
  ];

  const first = candidates.find((value): value is string => typeof value === 'string' && value.length > 0);
  return first ?? null;
}

export function getCharioOrderId(payload: Record<string, unknown>): string | null {
  const data = payload as {
    sale?: { id?: unknown };
  };
  const candidates = [
    data?.sale?.id,
  ];

  const first = candidates.find((value): value is string => typeof value === 'string' && value.length > 0);
  return first ?? null;
}

export function getCharioUserEmail(payload: Record<string, unknown>): string | null {
  const data = payload as {
    customer?: { email?: unknown };
  };
  const candidates = [
    data?.customer?.email,
  ];

  const first = candidates.find((value): value is string => typeof value === 'string' && value.length > 0);
  return first ?? null;
}
