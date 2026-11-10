/**
 * Run once to seed the plans collection.
 * ts-node -r tsconfig-paths/register scripts/seed-plans.ts
 */
import { getDb } from '../lib/mongodb';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'For individuals getting started',
    price_monthly: 9,
    price_annual: 90,
    prospects_per_month: 30,
    messages_per_month: 90,
    bulk_upload: false,
    max_bulk_urls: 0,
    paddle_price_id_monthly: null,
    paddle_price_id_annual: null,
    paddle_product_id_monthly: null,
    paddle_product_id_annual: null,
    is_active: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For growing sales teams',
    price_monthly: 19,
    price_annual: 190,
    prospects_per_month: 100,
    messages_per_month: 300,
    bulk_upload: true,
    max_bulk_urls: 50,
    paddle_price_id_monthly: process.env.PADDLE_PRO_MONTHLY_PRICE_ID ?? null,
    paddle_price_id_annual: process.env.PADDLE_PRO_ANNUAL_PRICE_ID ?? null,
    paddle_product_id_monthly: process.env.PADDLE_PRO_PRODUCT_ID ?? null,
    paddle_product_id_annual: process.env.PADDLE_PRO_PRODUCT_ID ?? null,
    is_active: true,
  },
  {
    id: 'business',
    name: 'Business',
    description: 'For high-volume outreach',
    price_monthly: 49,
    price_annual: 490,
    prospects_per_month: 300,
    messages_per_month: 900,
    bulk_upload: true,
    max_bulk_urls: 100,
    paddle_price_id_monthly: process.env.PADDLE_BUSINESS_MONTHLY_PRICE_ID ?? null,
    paddle_price_id_annual: process.env.PADDLE_BUSINESS_ANNUAL_PRICE_ID ?? null,
    paddle_product_id_monthly: process.env.PADDLE_BUSINESS_PRODUCT_ID ?? null,
    paddle_product_id_annual: process.env.PADDLE_BUSINESS_PRODUCT_ID ?? null,
    is_active: true,
  },
];

async function main() {
  const db = await getDb();
  const col = db.collection('plans');

  for (const plan of PLANS) {
    await col.updateOne({ id: plan.id }, { $set: plan }, { upsert: true });
    console.log(`Upserted plan: ${plan.id}`);
  }

  console.log('Plans seeded successfully.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
