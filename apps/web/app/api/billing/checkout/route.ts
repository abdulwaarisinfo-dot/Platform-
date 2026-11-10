import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-unified';
import { plans, users } from '@/lib/mongodb/collections';

const PADDLE_API_URL = 'https://api.paddle.com';

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  let body: { plan_id: string; billing_cycle?: 'monthly' | 'annual' };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON' } }, { status: 400 });
  }

  const { plan_id, billing_cycle = 'monthly' } = body;

  if (!['starter', 'pro', 'business'].includes(plan_id)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid plan' } }, { status: 400 });
  }

  const priceField = billing_cycle === 'annual' ? 'paddle_price_id_annual' : 'paddle_price_id_monthly';
  const plan = await (await plans()).findOne({ id: plan_id });
  if (!plan) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Plan not found' } }, { status: 404 });

  const priceId = (plan as Record<string, unknown>)[priceField] as string | null;
  if (!priceId) {
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Paddle price not configured' } }, { status: 500 });
  }

  const userDoc = await (await users()).findOne({ _id: userId as unknown as import('mongodb').ObjectId });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    const response = await fetch(`${PADDLE_API_URL}/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PADDLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        customer: { email: session.user.email, name: userDoc?.name ?? undefined },
        custom_data: { user_id: userId, plan_id },
        checkout: { url: `${appUrl}/billing/success` },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Paddle transaction error:', err);
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create checkout' } }, { status: 500 });
    }

    const data = (await response.json()) as { data: { checkout: { url: string } } };
    return NextResponse.json({ checkout_url: data.data.checkout.url });
  } catch (err) {
    console.error('Paddle error:', err);
    return NextResponse.json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Payment service unavailable' } }, { status: 503 });
  }
}
