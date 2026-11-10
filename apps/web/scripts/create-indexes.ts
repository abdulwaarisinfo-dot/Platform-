/**
 * Run once after initial deploy: ts-node -r tsconfig-paths/register scripts/create-indexes.ts
 */
import { getDb } from '../lib/mongodb';

async function main() {
  const db = await getDb();

  await db.collection('users').createIndexes([
    { key: { email: 1 }, unique: true },
  ]);

  await db.collection('accounts').createIndexes([
    { key: { provider: 1, providerAccountId: 1 }, unique: true },
    { key: { userId: 1 } },
  ]);

  await db.collection('sessions').createIndexes([
    { key: { sessionToken: 1 }, unique: true },
    { key: { userId: 1 } },
  ]);

  await db.collection('verification_tokens').createIndexes([
    { key: { identifier: 1, token: 1 }, unique: true },
  ]);

  await db.collection('subscriptions').createIndexes([
    { key: { user_id: 1 }, unique: true },
    { key: { paddle_subscription_id: 1 } },
  ]);

  await db.collection('usage_records').createIndexes([
    { key: { user_id: 1 }, unique: true },
  ]);

  await db.collection('prospects').createIndexes([
    { key: { user_id: 1, archived_at: 1, created_at: -1 } },
    { key: { user_id: 1, linkedin_url: 1 }, sparse: true },
    { key: { user_id: 1, status: 1 } },
  ]);

  await db.collection('research_records').createIndexes([
    { key: { prospect_id: 1, status: 1, created_at: -1 } },
    { key: { linkedin_url: 1, status: 1, expires_at: 1 }, sparse: true },
  ]);

  await db.collection('opportunity_analyses').createIndexes([
    { key: { prospect_id: 1, created_at: -1 } },
    { key: { user_id: 1 } },
  ]);

  await db.collection('generated_messages').createIndexes([
    { key: { prospect_id: 1, user_id: 1, created_at: -1 } },
  ]);

  await db.collection('business_brains').createIndexes([
    { key: { user_id: 1, is_active: 1 } },
  ]);

  await db.collection('brain_facts').createIndexes([
    { key: { brain_id: 1, is_active: 1, category: 1 } },
    { key: { user_id: 1 } },
  ]);

  await db.collection('followups').createIndexes([
    { key: { user_id: 1, completed_at: 1, due_at: 1 } },
    { key: { prospect_id: 1 } },
  ]);

  await db.collection('batch_jobs').createIndexes([
    { key: { user_id: 1, created_at: -1 } },
  ]);

  await db.collection('batch_urls').createIndexes([
    { key: { batch_job_id: 1, status: 1 } },
    { key: { normalized_url: 1 } },
  ]);

  await db.collection('webhook_events').createIndexes([
    { key: { event_id: 1 }, unique: true },
  ]);

  await db.collection('ai_cost_records').createIndexes([
    { key: { user_id: 1, created_at: -1 } },
  ]);

  await db.collection('password_reset_tokens').createIndexes([
    { key: { token: 1 }, unique: true },
    { key: { user_id: 1 } },
    { key: { expires_at: 1 }, expireAfterSeconds: 0 },
  ]);

  console.log('All indexes created successfully.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
