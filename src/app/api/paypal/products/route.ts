import { NextResponse } from 'next/server';
import { COIN_PRODUCTS } from '@/lib/paypal';

export async function GET() {
  return NextResponse.json({
    coinBundles: Object.values(COIN_PRODUCTS),
    subscriptions: [
      { key: 'monthly', amountMinor: 249, currency: 'USD', paypalPlanConfigured: Boolean(process.env.PAYPAL_PLAN_MONTHLY) },
      { key: 'annual', amountMinor: 1999, currency: 'USD', paypalPlanConfigured: Boolean(process.env.PAYPAL_PLAN_ANNUAL) },
    ],
  });
}
