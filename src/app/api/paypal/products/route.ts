import { NextResponse } from 'next/server';
import { COIN_PRODUCTS } from '@/lib/paypal';

export async function GET() {
  return NextResponse.json({
    coinBundles: Object.values(COIN_PRODUCTS),
    subscriptions: [
      { key: 'monthly', amountMinor: 2500, currency: 'XOF', paypalPlanConfigured: Boolean(process.env.PAYPAL_PLAN_MONTHLY) },
      { key: 'annual', amountMinor: 20000, currency: 'XOF', paypalPlanConfigured: Boolean(process.env.PAYPAL_PLAN_ANNUAL) },
    ],
  });
}
