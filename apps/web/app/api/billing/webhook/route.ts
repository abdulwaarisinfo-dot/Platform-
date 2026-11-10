import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { subscriptions, usageRecords, webhookEvents, plans } from '@/lib/mongodb/collections';
import { claimWebhookEvent } from '@/lib/webhook/claimEvent';

async function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = Object.fromEntries(
    signatureHeader.split(';').map((p) => p.split('=')),
  ) as Record<string, string>;

  const { ts, h1 } = parts;
  if (!ts || !h1) return false;

  const payload = `${ts}:${rawBody}`;
  const keyData = new TextEncoder().encode(secret);
  const msgData = new TextEncoder().encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
  );

  const sigBytes = Buffer.from(h1, 'hex');
  return crypto.subtle.verify('HMAC', cryptoKey, sigBytes, msgData);
}

type PaddleEvent = {
  event_id: string;
  event_type: string;
  data: {
    id: string;
    customer_id: string;
    status: string;
    custom_data?: { user_id?: string; plan_id?: string };
    items?: Array<{ price: { product_id: string }; status: string }>;
    current_billing_period?: { ends_at: string };
  };
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get('paddle-signature') ?? '';
  const secret = process.env.PADDLE_WEBHOOK_SECRET ?? '';

  const valid = await verifyPaddleSignature(rawBody, signatureHeader, secret);
  if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  let event: PaddleEvent;
  try { event = JSON.parse(rawBody) as PaddleEvent; } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventsCol = await webhookEvents();
  const now = new Date();

  const claimResult = await claimWebhookEvent(eventsCol, event.event_id, now, {
    event_type: event.event_type,
    payload: event as unknown as Record<string, unknown>,
  });

  if (claimResult === 'already_processed') return NextResponse.json({ status: 'already_processed' });
  if (claimResult === 'processing_in_progress') return NextResponse.json({ status: 'processing_in_progress' });

  const userId = event.data.custom_data?.user_id;
  if (!userId) {
    await eventsCol.updateOne(
      { event_id: event.event_id },
      { $set: { status: 'completed', processed_at: now } },
    );
    return NextResponse.json({ status: 'no_user' });
  }

  try {
    switch (event.event_type) {
      case 'subscription.created':
      case 'subscription.updated': {
        const item = event.data.items?.[0];
        let resolvedPlanId = event.data.custom_data?.plan_id ?? 'starter';

        if (item?.price?.product_id) {
          const plan = await (await plans()).findOne({
            $or: [
              { paddle_product_id_monthly: item.price.product_id },
              { paddle_product_id_annual: item.price.product_id },
            ],
          });
          if (plan) resolvedPlanId = plan.id as string;
        }

        await (await subscriptions()).updateOne(
          { user_id: userId },
          {
            $set: {
              user_id: userId,
              plan_id: resolvedPlanId,
              status: event.data.status,
              paddle_subscription_id: event.data.id,
              paddle_customer_id: event.data.customer_id,
              current_period_end: event.data.current_billing_period?.ends_at
                ? new Date(event.data.current_billing_period.ends_at)
                : null,
              updated_at: now,
            },
          },
          { upsert: true },
        );
        break;
      }

      case 'subscription.canceled': {
        await (await subscriptions()).updateOne(
          { paddle_subscription_id: event.data.id },
          { $set: { status: 'canceled', updated_at: now } },
        );
        break;
      }

      case 'subscription.payment_succeeded': {
        // Reset monthly usage on successful renewal
        await (await usageRecords()).updateOne(
          { user_id: userId },
          {
            $set: {
              prospect_research_used: 0,
              messages_generated_used: 0,
              period_start: now,
              updated_at: now,
            },
          },
        );
        break;
      }

      case 'subscription.payment_failed': {
        await (await subscriptions()).updateOne(
          { paddle_subscription_id: event.data.id },
          { $set: { status: 'past_due', updated_at: now } },
        );
        break;
      }
    }

    await eventsCol.updateOne(
      { event_id: event.event_id },
      { $set: { status: 'completed', processed_at: now } },
    );
    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    await eventsCol.updateOne(
      { event_id: event.event_id },
      { $set: { status: 'failed', error: String(err), failed_at: now } },
    );
    // Return 500 so Paddle retries — the stale-processing logic above handles re-entry
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
