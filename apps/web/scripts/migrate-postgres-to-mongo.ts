/**
 * PostgreSQL (Supabase) → MongoDB data migration utility.
 *
 * Usage:
 *   # Dry run (counts only, no writes):
 *   DRY_RUN=true ts-node -r tsconfig-paths/register scripts/migrate-postgres-to-mongo.ts
 *
 *   # Live migration:
 *   ts-node -r tsconfig-paths/register scripts/migrate-postgres-to-mongo.ts
 *
 * Required env vars:
 *   POSTGRES_URL       — Supabase direct connection URL (postgres://user:pass@host/db)
 *   MONGODB_URI        — MongoDB Atlas connection string
 *   MONGODB_DB_NAME    — MongoDB database name (default: platform)
 *   DRY_RUN            — "true" to skip writes (default: false)
 *
 * Safety:
 *   - Never modifies the Postgres database.
 *   - All writes use upsert — re-runs are idempotent.
 *   - Dry run reports row counts without touching MongoDB.
 *   - FK relationships are fully resolved: each dependent table gets
 *     MongoDB IDs for its foreign-key columns via ID maps built after
 *     migrating the referenced table.
 *
 * ID strategy:
 *   - Each Postgres UUID is stored as `pg_id` on the MongoDB document for
 *     traceability and idempotent re-runs.
 *   - New ObjectIds are generated for MongoDB _id fields.
 *   - After migrating each parent table an id map (pg_uuid → mongo_id) is
 *     built so child tables reference correct MongoDB IDs.
 *
 * Password strategy:
 *   - Supabase stores bcrypt hashes in auth.users.encrypted_password.
 *   - These are preserved as `legacy_password_hash` on the MongoDB user doc.
 *   - The NextAuth Credentials provider uses argon2 for new passwords.
 *   - Migrated email/password users must reset their password via
 *     /reset-password before logging in with credentials.
 *   - Google OAuth users are unaffected — their accounts are recreated by
 *     NextAuth on first sign-in.
 *
 * Usage limit resolution:
 *   - Each usage_record row's limits are resolved from the user's active
 *     subscription's plan (prospects_per_month, messages_per_month).
 *   - Falls back to the 'starter' plan limits (30/90) if no plan is found.
 */

import { MongoClient, ObjectId } from 'mongodb';
import { Client as PgClient } from 'pg';

const DRY_RUN = process.env.DRY_RUN === 'true';
const MONGODB_URI = process.env.MONGODB_URI!;
const MONGODB_DB = process.env.MONGODB_DB_NAME ?? 'platform';
const POSTGRES_URL = process.env.POSTGRES_URL!;

function requireEnv() {
  const missing = ['MONGODB_URI', 'POSTGRES_URL'].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
}

interface MigrationResult {
  table: string;
  pg_rows: number;
  mongo_before: number;
  upserted: number;
  errors: number;
  mongo_after: number;
}

const results: MigrationResult[] = [];

async function countMongo(mongo: MongoClient, collection: string): Promise<number> {
  return mongo.db(MONGODB_DB).collection(collection).countDocuments();
}

async function migrateTable(
  pg: PgClient,
  mongo: MongoClient,
  pgTable: string,
  mongoCollection: string,
  transform: (row: Record<string, unknown>) => Record<string, unknown>,
  upsertKey: string = 'pg_id',
): Promise<Map<string, string>> {
  const { rows } = await pg.query(`SELECT * FROM ${pgTable}`);
  console.log(`  ${pgTable}: ${rows.length} rows`);

  const col = mongo.db(MONGODB_DB).collection(mongoCollection);
  const before = await col.countDocuments();

  if (DRY_RUN) {
    results.push({ table: pgTable, pg_rows: rows.length, mongo_before: before, upserted: 0, errors: 0, mongo_after: before });
    return new Map();
  }

  let upserted = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const doc = transform(row as Record<string, unknown>);
      await col.updateOne(
        { [upsertKey]: doc[upsertKey] },
        { $setOnInsert: { _id: new ObjectId() }, $set: doc },
        { upsert: true },
      );
      upserted++;
    } catch (err) {
      errors++;
      console.error(`    ERROR on row ${(row as Record<string, unknown>).id}:`, err);
    }
  }

  const after = await col.countDocuments();
  results.push({ table: pgTable, pg_rows: rows.length, mongo_before: before, upserted, errors, mongo_after: after });
  console.log(`    → ${upserted} upserted, ${errors} errors (mongo: ${before} → ${after})`);

  // Build and return pg_id → mongo _id map for FK resolution
  const idMap = new Map<string, string>();
  const docs = await col.find({ pg_id: { $exists: true } }, { projection: { pg_id: 1 } }).toArray();
  for (const d of docs) {
    if (d.pg_id) idMap.set(d.pg_id as string, d._id.toString());
  }
  return idMap;
}

function isoDate(val: unknown): Date | null {
  if (!val) return null;
  return val instanceof Date ? val : new Date(val as string);
}

async function main() {
  requireEnv();
  console.log(`Platform PostgreSQL → MongoDB Migration ${DRY_RUN ? '[DRY RUN]' : '[LIVE]'}`);
  console.log(`Source: ${POSTGRES_URL.replace(/:\/\/.*@/, '://<credentials>@')}`);
  console.log(`Target: ${MONGODB_URI.replace(/:\/\/.*@/, '://<credentials>@')} / ${MONGODB_DB}\n`);

  const pg = new PgClient({ connectionString: POSTGRES_URL });
  const mongo = new MongoClient(MONGODB_URI);

  await pg.connect();
  await mongo.connect();

  try {
    // ── [1/16] plans ─────────────────────────────────────────────────────────
    // plans is reference data: no pg_id needed, upsert on `id` field
    console.log('\n[1/16] Migrating plans...');
    {
      const { rows } = await pg.query('SELECT * FROM public.plans');
      console.log(`  public.plans: ${rows.length} rows`);
      const col = mongo.db(MONGODB_DB).collection('plans');
      const before = await col.countDocuments();
      if (!DRY_RUN) {
        let upserted = 0;
        let errors = 0;
        for (const row of rows as Record<string, unknown>[]) {
          try {
            await col.updateOne(
              { id: row.id },
              {
                $setOnInsert: { _id: new ObjectId() },
                $set: {
                  id: row.id,
                  name: row.name,
                  price_monthly_usd: row.price_monthly_usd,
                  price_annual_usd: row.price_annual_usd ?? null,
                  prospects_per_month: row.prospects_per_month ?? 30,
                  messages_per_month: row.messages_per_month ?? 90,
                  bulk_upload_enabled: row.bulk_upload_enabled ?? false,
                  max_batch_size: row.max_batch_size ?? 0,
                  paddle_product_id: row.paddle_product_id ?? null,
                  paddle_price_id_monthly: row.paddle_price_id_monthly ?? null,
                  paddle_price_id_annual: row.paddle_price_id_annual ?? null,
                  paddle_product_id_monthly: row.paddle_product_id_monthly ?? null,
                  paddle_product_id_annual: row.paddle_product_id_annual ?? null,
                  is_active: row.is_active ?? true,
                },
              },
              { upsert: true },
            );
            upserted++;
          } catch (err) {
            errors++;
            console.error(`    ERROR on plan ${row.id}:`, err);
          }
        }
        const after = await col.countDocuments();
        results.push({ table: 'public.plans', pg_rows: rows.length, mongo_before: before, upserted, errors, mongo_after: after });
        console.log(`    → ${upserted} upserted, ${errors} errors (mongo: ${before} → ${after})`);
      } else {
        results.push({ table: 'public.plans', pg_rows: rows.length, mongo_before: before, upserted: 0, errors: 0, mongo_after: before });
      }
    }

    // Build plan limits map: plan_id → { prospects_per_month, messages_per_month }
    const planLimitsMap = new Map<string, { prospects: number; messages: number }>();
    {
      const { rows } = await pg.query('SELECT id, prospects_per_month, messages_per_month FROM public.plans');
      for (const row of rows as Record<string, unknown>[]) {
        planLimitsMap.set(row.id as string, {
          prospects: (row.prospects_per_month as number) ?? 30,
          messages: (row.messages_per_month as number) ?? 90,
        });
      }
      // Defaults for 'starter' plan if not in DB
      if (!planLimitsMap.has('starter')) planLimitsMap.set('starter', { prospects: 30, messages: 90 });
    }

    // ── [2/16] users (from auth.users + public.profiles) ─────────────────────
    console.log('\n[2/16] Migrating users...');
    const userIdMap = await migrateTable(
      pg, mongo, 'auth.users', 'users',
      (row) => ({
        pg_id: row.id,
        email: row.email,
        name: null,
        email_verified: isoDate(row.email_confirmed_at),
        legacy_password_hash: row.encrypted_password ?? null,
        created_at: isoDate(row.created_at),
        updated_at: isoDate(row.updated_at),
      }),
    );

    // Merge public.profiles fields (name, avatar_url) into user docs
    if (!DRY_RUN) {
      const { rows: profiles } = await pg.query('SELECT * FROM public.profiles');
      for (const p of profiles as Record<string, unknown>[]) {
        const mongoId = userIdMap.get(p.id as string);
        if (!mongoId) continue;
        await mongo.db(MONGODB_DB).collection('users').updateOne(
          { _id: new ObjectId(mongoId) },
          { $set: { name: p.full_name ?? p.name ?? null, avatar_url: p.avatar_url ?? null } },
        );
      }
      console.log(`    Merged ${profiles.length} profile rows into users`);
    }

    const resolveUserId = (pgId: unknown): string =>
      userIdMap.get(pgId as string) ?? (pgId as string);

    // ── [3/16] business_brains ───────────────────────────────────────────────
    console.log('\n[3/16] Migrating business_brains...');
    const brainIdMap = await migrateTable(pg, mongo, 'public.business_brains', 'business_brains', (row) => ({
      pg_id: row.id,
      user_id: resolveUserId(row.user_id),
      business_name: row.business_name ?? null,
      website: row.website ?? null,
      description: row.description ?? null,
      services: row.services ?? [],
      icp_industries: row.icp_industries ?? [],
      icp_company_sizes: row.icp_company_sizes ?? [],
      icp_job_titles: row.icp_job_titles ?? [],
      pain_points: row.pain_points ?? [],
      differentiators: row.differentiators ?? [],
      communication_tone: row.communication_tone ?? 'professional',
      created_at: isoDate(row.created_at),
      updated_at: isoDate(row.updated_at),
    }));

    const resolveBrainId = (pgId: unknown): string | null =>
      pgId ? (brainIdMap.get(pgId as string) ?? (pgId as string)) : null;

    // ── [4/16] brain_facts ───────────────────────────────────────────────────
    console.log('\n[4/16] Migrating brain_facts...');
    await migrateTable(pg, mongo, 'public.brain_facts', 'brain_facts', (row) => ({
      pg_id: row.id,
      user_id: resolveUserId(row.user_id),
      brain_id: resolveBrainId(row.brain_id),
      fact: row.fact ?? row.content ?? '',
      category: row.category ?? null,
      confidence: row.confidence ?? 'inferred',
      source: row.source ?? null,
      is_active: row.is_active ?? true,
      created_at: isoDate(row.created_at),
      updated_at: isoDate(row.updated_at),
    }));

    // ── [5/16] subscriptions ─────────────────────────────────────────────────
    console.log('\n[5/16] Migrating subscriptions...');
    const subscriptionIdMap = await migrateTable(pg, mongo, 'public.subscriptions', 'subscriptions', (row) => ({
      pg_id: row.id,
      user_id: resolveUserId(row.user_id),
      plan_id: row.plan_id,
      status: row.status,
      paddle_subscription_id: row.paddle_subscription_id ?? null,
      paddle_customer_id: row.paddle_customer_id ?? null,
      current_period_start: isoDate(row.current_period_start),
      current_period_end: isoDate(row.current_period_end),
      cancel_at_period_end: row.cancel_at_period_end ?? false,
      created_at: isoDate(row.created_at),
      updated_at: isoDate(row.updated_at),
    }));

    // Build user_id → plan_id map for usage limit resolution
    const userPlanMap = new Map<string, string>();
    if (!DRY_RUN) {
      const { rows: subs } = await pg.query(
        "SELECT user_id, plan_id FROM public.subscriptions WHERE status IN ('active', 'trialing') ORDER BY created_at DESC",
      );
      for (const s of subs as Record<string, unknown>[]) {
        const mongoUserId = resolveUserId(s.user_id);
        if (!userPlanMap.has(mongoUserId)) {
          userPlanMap.set(mongoUserId, s.plan_id as string);
        }
      }
    }

    // ── [6/16] usage_records ─────────────────────────────────────────────────
    // Limits are resolved from the user's subscription plan, not migrated as zero.
    console.log('\n[6/16] Migrating usage_records...');
    await migrateTable(pg, mongo, 'public.usage_records', 'usage_records', (row) => {
      const mongoUserId = resolveUserId(row.user_id);
      const planId = userPlanMap.get(mongoUserId) ?? 'starter';
      const limits = planLimitsMap.get(planId) ?? { prospects: 30, messages: 90 };

      // Prefer the app-layer columns (reconcile migration 0005) if present
      const researchUsed = (row.prospect_research_used as number | null) ??
        (row.prospects_used as number | null) ?? 0;
      const messagesUsed = (row.messages_generated_used as number | null) ??
        (row.messages_used as number | null) ?? 0;

      return {
        pg_id: row.id,
        user_id: mongoUserId,
        subscription_id: row.subscription_id
          ? (subscriptionIdMap.get(row.subscription_id as string) ?? (row.subscription_id as string))
          : null,
        prospect_research_used: researchUsed,
        prospect_research_limit: limits.prospects,
        messages_generated_used: messagesUsed,
        messages_generated_limit: limits.messages,
        period_start: isoDate(row.period_start ?? row.created_at),
        period_end: isoDate(row.period_end),
        created_at: isoDate(row.created_at),
        updated_at: isoDate(row.updated_at),
      };
    });

    // ── [7/16] prospects ─────────────────────────────────────────────────────
    console.log('\n[7/16] Migrating prospects...');
    const prospectIdMap = await migrateTable(pg, mongo, 'public.prospects', 'prospects', (row) => ({
      pg_id: row.id,
      user_id: resolveUserId(row.user_id),
      full_name: row.full_name,
      company_name: row.company_name ?? null,
      professional_title: row.professional_title ?? null,
      linkedin_url: row.linkedin_url ?? null,
      company_website: row.company_website ?? null,
      user_provided_bio: row.user_provided_bio ?? null,
      status: row.status ?? 'new',
      connection_status: row.connection_status ?? null,
      pipeline_stage: row.pipeline_stage ?? 'new',
      notes: row.notes ?? null,
      last_activity_at: isoDate(row.last_activity_at),
      archived_at: isoDate(row.archived_at),
      created_at: isoDate(row.created_at),
      updated_at: isoDate(row.updated_at),
    }));

    const resolveProspectId = (pgId: unknown): string | null =>
      pgId ? (prospectIdMap.get(pgId as string) ?? (pgId as string)) : null;

    // ── [8/16] research_records ──────────────────────────────────────────────
    console.log('\n[8/16] Migrating research_records...');
    await migrateTable(pg, mongo, 'public.research_records', 'research_records', (row) => ({
      pg_id: row.id,
      prospect_id: resolveProspectId(row.prospect_id),
      user_id: resolveUserId(row.user_id),
      linkedin_url: row.linkedin_url ?? null,
      status: row.status,
      input_mode: row.input_mode ?? 'linkedin_url',
      cached: row.cached ?? false,
      professional_summary: row.professional_summary ?? null,
      company_summary: row.company_summary ?? null,
      recent_developments: row.recent_developments ?? [],
      potential_signals: row.potential_signals ?? [],
      confidence: row.confidence ?? 'low',
      enrichment_confidence: row.enrichment_confidence ?? null,
      enrichment_matched: row.enrichment_matched ?? false,
      gaps: row.gaps ?? [],
      sources: row.sources ?? [],
      cost_usd: row.cost_usd ?? 0,
      tokens_used: row.tokens_used ?? 0,
      expires_at: isoDate(row.expires_at),
      error_message: row.error_message ?? null,
      created_at: isoDate(row.created_at),
      updated_at: isoDate(row.updated_at),
    }));

    // ── [9/16] opportunity_analyses ──────────────────────────────────────────
    console.log('\n[9/16] Migrating opportunity_analyses...');
    await migrateTable(pg, mongo, 'public.opportunity_analyses', 'opportunity_analyses', (row) => ({
      pg_id: row.id,
      prospect_id: resolveProspectId(row.prospect_id),
      user_id: resolveUserId(row.user_id),
      score: row.score ?? null,
      summary: row.summary ?? null,
      signals: row.signals ?? [],
      created_at: isoDate(row.created_at),
    }));

    // ── [10/16] generated_messages ────────────────────────────────────────────
    console.log('\n[10/16] Migrating generated_messages...');
    await migrateTable(pg, mongo, 'public.generated_messages', 'generated_messages', (row) => ({
      pg_id: row.id,
      prospect_id: resolveProspectId(row.prospect_id),
      user_id: resolveUserId(row.user_id),
      channel: row.channel ?? 'linkedin',
      tone: row.tone ?? null,
      subject: row.subject ?? null,
      body: row.body ?? '',
      is_selected: row.is_selected ?? false,
      created_at: isoDate(row.created_at),
    }));

    // ── [11/16] followups ─────────────────────────────────────────────────────
    console.log('\n[11/16] Migrating followups...');
    await migrateTable(pg, mongo, 'public.followups', 'followups', (row) => ({
      pg_id: row.id,
      user_id: resolveUserId(row.user_id),
      prospect_id: resolveProspectId(row.prospect_id),
      note: row.note ?? null,
      due_at: isoDate(row.due_at),
      completed_at: isoDate(row.completed_at),
      created_at: isoDate(row.created_at),
      updated_at: isoDate(row.updated_at),
    }));

    // ── [12/16] batch_jobs ────────────────────────────────────────────────────
    console.log('\n[12/16] Migrating batch_jobs...');
    const batchJobIdMap = await migrateTable(pg, mongo, 'public.batch_jobs', 'batch_jobs', (row) => ({
      pg_id: row.id,
      user_id: resolveUserId(row.user_id),
      name: row.name ?? null,
      status: row.status,
      total_urls: row.total_urls ?? 0,
      completed_count: row.completed_urls ?? row.completed_count ?? 0,
      failed_count: row.failed_count ?? 0,
      skipped_count: row.skipped_count ?? 0,
      usage_reserved: row.usage_reserved ?? 0,
      usage_consumed: row.usage_consumed ?? 0,
      inngest_event_id: row.inngest_event_id ?? null,
      started_at: isoDate(row.started_at),
      completed_at: isoDate(row.completed_at),
      cancelled_at: isoDate(row.cancelled_at),
      created_at: isoDate(row.created_at),
      updated_at: isoDate(row.updated_at),
    }));

    const resolveBatchJobId = (pgId: unknown): string | null =>
      pgId ? (batchJobIdMap.get(pgId as string) ?? (pgId as string)) : null;

    // ── [13/16] batch_urls ────────────────────────────────────────────────────
    // batch_job_id FK resolved to MongoDB IDs via batchJobIdMap
    console.log('\n[13/16] Migrating batch_urls...');
    await migrateTable(pg, mongo, 'public.batch_urls', 'batch_urls', (row) => ({
      pg_id: row.id,
      batch_job_id: resolveBatchJobId(row.batch_job_id),
      user_id: resolveUserId(row.user_id),
      linkedin_url: row.url ?? row.linkedin_url,
      normalized_url: row.normalized_url ?? row.url,
      status: row.status,
      skip_reason: row.skip_reason ?? null,
      error_message: row.error_message ?? null,
      prospect_id: resolveProspectId(row.prospect_id),
      processing_started_at: isoDate(row.processing_started_at),
      processing_completed_at: isoDate(row.processing_completed_at),
      created_at: isoDate(row.created_at),
    }));

    // ── [14/16] ai_cost_records ───────────────────────────────────────────────
    console.log('\n[14/16] Migrating ai_cost_records...');
    await migrateTable(pg, mongo, 'public.ai_cost_records', 'ai_cost_records', (row) => ({
      pg_id: row.id,
      user_id: resolveUserId(row.user_id),
      prospect_id: resolveProspectId(row.prospect_id),
      batch_job_id: resolveBatchJobId(row.batch_job_id),
      operation: row.operation,
      model: row.model,
      input_tokens: row.input_tokens ?? 0,
      output_tokens: row.output_tokens ?? 0,
      cost_usd: row.cost_usd ?? 0,
      enrichment_provider: row.enrichment_provider ?? null,
      enrichment_matched: row.enrichment_matched ?? null,
      created_at: isoDate(row.created_at),
    }));

    // ── [15/16] webhook_events ────────────────────────────────────────────────
    // Historical records; upsert on (provider, event_id) composite key
    console.log('\n[15/16] Migrating webhook_events...');
    {
      const { rows } = await pg.query('SELECT * FROM public.webhook_events');
      console.log(`  public.webhook_events: ${rows.length} rows`);
      const col = mongo.db(MONGODB_DB).collection('webhook_events');
      const before = await col.countDocuments();
      if (!DRY_RUN) {
        let upserted = 0;
        let errors = 0;
        for (const row of rows as Record<string, unknown>[]) {
          try {
            await col.updateOne(
              { event_id: row.event_id, provider: row.provider },
              {
                $setOnInsert: { _id: new ObjectId() },
                $set: {
                  pg_id: row.id,
                  provider: row.provider,
                  event_id: row.event_id,
                  event_type: row.event_type,
                  payload: row.payload,
                  status: row.processed_at ? 'completed' : 'unknown',
                  processed_at: isoDate(row.processed_at),
                  received_at: isoDate(row.created_at),
                },
              },
              { upsert: true },
            );
            upserted++;
          } catch (err) {
            errors++;
            console.error(`    ERROR on webhook event ${row.event_id}:`, err);
          }
        }
        const after = await col.countDocuments();
        results.push({ table: 'public.webhook_events', pg_rows: rows.length, mongo_before: before, upserted, errors, mongo_after: after });
        console.log(`    → ${upserted} upserted, ${errors} errors (mongo: ${before} → ${after})`);
      } else {
        results.push({ table: 'public.webhook_events', pg_rows: rows.length, mongo_before: before, upserted: 0, errors: 0, mongo_after: before });
      }
    }

    // ── [16/16] Foreign-key verification ────────────────────────────────────
    // Dangling references are treated as migration failures, not warnings.
    // Any dangling FK aborts with exit code 1 so the operator must resolve
    // data issues before retrying rather than silently leaving orphaned docs.
    console.log('\n[16/16] Foreign-key relationship verification...');
    if (!DRY_RUN) {
      // refField defaults to '_id' (MongoDB ObjectId); set to 'id' for string-keyed parents (e.g. plans).
      const checks: Array<{ label: string; collection: string; fkField: string; refCollection: string; refField?: string }> = [
        // ── users ──────────────────────────────────────────────────────────────
        { label: 'batch_jobs.user_id → users._id',                    collection: 'batch_jobs',            fkField: 'user_id',          refCollection: 'users' },
        { label: 'batch_urls.user_id → users._id',                    collection: 'batch_urls',            fkField: 'user_id',          refCollection: 'users' },
        { label: 'prospects.user_id → users._id',                     collection: 'prospects',             fkField: 'user_id',          refCollection: 'users' },
        { label: 'research_records.user_id → users._id',              collection: 'research_records',      fkField: 'user_id',          refCollection: 'users' },
        { label: 'opportunity_analyses.user_id → users._id',          collection: 'opportunity_analyses',  fkField: 'user_id',          refCollection: 'users' },
        { label: 'generated_messages.user_id → users._id',            collection: 'generated_messages',    fkField: 'user_id',          refCollection: 'users' },
        { label: 'followups.user_id → users._id',                     collection: 'followups',             fkField: 'user_id',          refCollection: 'users' },
        { label: 'subscriptions.user_id → users._id',                 collection: 'subscriptions',         fkField: 'user_id',          refCollection: 'users' },
        { label: 'usage_records.user_id → users._id',                 collection: 'usage_records',         fkField: 'user_id',          refCollection: 'users' },
        { label: 'business_brains.user_id → users._id',               collection: 'business_brains',       fkField: 'user_id',          refCollection: 'users' },
        { label: 'brain_facts.user_id → users._id',                   collection: 'brain_facts',           fkField: 'user_id',          refCollection: 'users' },
        { label: 'ai_cost_records.user_id → users._id',               collection: 'ai_cost_records',       fkField: 'user_id',          refCollection: 'users' },
        // ── plans (parent field is string 'id', not '_id') ────────────────────
        { label: 'subscriptions.plan_id → plans.id',                  collection: 'subscriptions',         fkField: 'plan_id',          refCollection: 'plans', refField: 'id' },
        // ── batch_jobs ────────────────────────────────────────────────────────
        { label: 'batch_urls.batch_job_id → batch_jobs._id',          collection: 'batch_urls',            fkField: 'batch_job_id',     refCollection: 'batch_jobs' },
        { label: 'ai_cost_records.batch_job_id → batch_jobs._id',     collection: 'ai_cost_records',       fkField: 'batch_job_id',     refCollection: 'batch_jobs' },
        // ── prospects ─────────────────────────────────────────────────────────
        { label: 'research_records.prospect_id → prospects._id',      collection: 'research_records',      fkField: 'prospect_id',      refCollection: 'prospects' },
        { label: 'opportunity_analyses.prospect_id → prospects._id',  collection: 'opportunity_analyses',  fkField: 'prospect_id',      refCollection: 'prospects' },
        { label: 'generated_messages.prospect_id → prospects._id',    collection: 'generated_messages',    fkField: 'prospect_id',      refCollection: 'prospects' },
        { label: 'followups.prospect_id → prospects._id',             collection: 'followups',             fkField: 'prospect_id',      refCollection: 'prospects' },
        { label: 'batch_urls.prospect_id → prospects._id',            collection: 'batch_urls',            fkField: 'prospect_id',      refCollection: 'prospects' },
        { label: 'ai_cost_records.prospect_id → prospects._id',       collection: 'ai_cost_records',       fkField: 'prospect_id',      refCollection: 'prospects' },
        // ── research_records ──────────────────────────────────────────────────
        { label: 'opportunity_analyses.research_id → research_records._id', collection: 'opportunity_analyses', fkField: 'research_id', refCollection: 'research_records' },
        // ── opportunity_analyses ──────────────────────────────────────────────
        { label: 'generated_messages.opportunity_id → opportunity_analyses._id', collection: 'generated_messages', fkField: 'opportunity_id', refCollection: 'opportunity_analyses' },
        // ── generated_messages (self-ref, nullable) ───────────────────────────
        { label: 'generated_messages.parent_id → generated_messages._id', collection: 'generated_messages', fkField: 'parent_id',      refCollection: 'generated_messages' },
        // ── subscriptions ─────────────────────────────────────────────────────
        { label: 'usage_records.subscription_id → subscriptions._id', collection: 'usage_records',         fkField: 'subscription_id', refCollection: 'subscriptions' },
        // ── business_brains ───────────────────────────────────────────────────
        { label: 'brain_facts.brain_id → business_brains._id',        collection: 'brain_facts',           fkField: 'brain_id',         refCollection: 'business_brains' },
      ];

      const allDangling: string[] = [];

      for (const check of checks) {
        const db = mongo.db(MONGODB_DB);
        const refField = check.refField ?? '_id';
        const childDocs = await db.collection(check.collection).find({}, { projection: { [check.fkField]: 1 } }).toArray();
        const fkValues = new Set(childDocs.map(d => d[check.fkField]?.toString()).filter(Boolean));

        // For string-keyed parents (refField !== '_id') project that field; otherwise project _id
        const parentProjection = refField === '_id' ? { _id: 1 } : { [refField]: 1 };
        const parentDocs = await db.collection(check.refCollection).find({}, { projection: parentProjection }).toArray();
        const parentIds = new Set(parentDocs.map(d => (refField === '_id' ? d._id : d[refField])?.toString()).filter(Boolean));

        const dangling = [...fkValues].filter(v => !parentIds.has(v));
        if (dangling.length > 0) {
          console.error(`  ✗  ${check.label}: ${dangling.length} dangling references (sample: ${dangling.slice(0, 3).join(', ')})`);
          allDangling.push(`${check.label}: ${dangling.length} dangling`);
        } else {
          console.log(`  ✓  ${check.label}: all ${fkValues.size} references valid`);
        }
      }

      if (allDangling.length > 0) {
        throw new Error(`Foreign-key verification failed:\n${allDangling.join('\n')}`);
      }
    }

  } finally {
    await pg.end();
    await mongo.close();
  }

  console.log('\n=== Migration Summary ===\n');
  const header = 'Table'.padEnd(35) + 'PG Rows'.padStart(9) + 'Mongo Before'.padStart(14) + 'Upserted'.padStart(10) + 'Errors'.padStart(8) + 'Mongo After'.padStart(13);
  console.log(header);
  console.log('-'.repeat(89));
  let totalPg = 0; let totalUpserted = 0; let totalErrors = 0;
  for (const r of results) {
    console.log(
      r.table.padEnd(35) +
      String(r.pg_rows).padStart(9) +
      String(r.mongo_before).padStart(14) +
      String(r.upserted).padStart(10) +
      String(r.errors).padStart(8) +
      String(r.mongo_after).padStart(13),
    );
    totalPg += r.pg_rows;
    totalUpserted += r.upserted;
    totalErrors += r.errors;
  }
  console.log('-'.repeat(89));
  console.log('TOTAL'.padEnd(35) + String(totalPg).padStart(9) + ''.padStart(14) + String(totalUpserted).padStart(10) + String(totalErrors).padStart(8));

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No data was written to MongoDB.');
  } else if (totalErrors > 0) {
    console.log(`\n⚠  Migration completed with ${totalErrors} error(s). Review logs above.`);
    process.exit(1);
  } else {
    console.log('\n✓ Migration completed successfully.');
  }

  console.log('\nNOTE: Migrated email/password users must reset their password via /reset-password.');
  console.log('      Google OAuth users are not affected.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
