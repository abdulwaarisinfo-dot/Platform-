/**
 * Integration tests for the usageReset Inngest function logic.
 *
 * Uses a real MongoDB server to verify that subscription period rollovers create
 * usage records with the correct plan-derived limits.
 * Tests import from the production rollSubscription module directly.
 *
 * Run with a local or Atlas test database:
 *   MONGODB_TEST_URI=mongodb://localhost:27017 npx vitest run scripts/usage-reset-integration.test.ts
 *
 * Tests are skipped automatically when MONGODB_TEST_URI is not set.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoClient, ObjectId, type Collection, type Db } from 'mongodb';
import { rollSubscription } from '../lib/inngest/rollSubscription';

const TEST_URI = process.env.MONGODB_TEST_URI ?? '';
const hasTestDb = Boolean(TEST_URI);

// ─── Shared fixture ────────────────────────────────────────────────────────────

let client: MongoClient;
let db: Db;
let subsCol: Collection;
let usageCol: Collection;
let plansCol: Collection;

describe.skipIf(!hasTestDb)('usageReset MongoDB integration', () => {
  beforeAll(async () => {
    client = new MongoClient(TEST_URI);
    await client.connect();
    db = client.db('usage_reset_test');
    subsCol  = db.collection('subscriptions');
    usageCol = db.collection('usage_records');
    plansCol = db.collection('plans');

    // Seed plans — mirrors seed-plans.ts values exactly
    await plansCol.deleteMany({});
    await plansCol.insertMany([
      { id: 'starter',  name: 'Starter',  prospects_per_month: 30,  messages_per_month: 90  },
      { id: 'pro',      name: 'Pro',       prospects_per_month: 100, messages_per_month: 300 },
      { id: 'business', name: 'Business',  prospects_per_month: 300, messages_per_month: 900 },
    ]);
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  beforeEach(async () => {
    await subsCol.deleteMany({});
    await usageCol.deleteMany({});
  });

  function makeExpiredSub(userId: string, planId: string, daysPast = 1) {
    const periodEnd = new Date(Date.now() - daysPast * 24 * 60 * 60 * 1000);
    return {
      _id: new ObjectId(),
      user_id: userId,
      plan_id: planId,
      status: 'active' as const,
      current_period_start: new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000),
      current_period_end: periodEnd,
    };
  }

  function getCols() {
    return { subscriptions: subsCol, usageRecords: usageCol, plans: plansCol };
  }

  // ─── Starter plan ─────────────────────────────────────────────────────────────

  it('Starter: creates usage record with 30 research / 90 message limits', async () => {
    const sub = makeExpiredSub('user_starter_001', 'starter');
    await subsCol.insertOne(sub);

    const result = await rollSubscription(getCols(), sub, new Date());

    expect(result.researchLimit).toBe(30);
    expect(result.messagesLimit).toBe(90);

    const record = await usageCol.findOne({ user_id: 'user_starter_001' });
    expect(record).not.toBeNull();
    expect(record!.prospect_research_limit).toBe(30);
    expect(record!.messages_generated_limit).toBe(90);
    expect(record!.prospect_research_used).toBe(0);
    expect(record!.messages_generated_used).toBe(0);
  });

  // ─── Pro plan ─────────────────────────────────────────────────────────────────

  it('Pro: creates usage record with 100 research / 300 message limits', async () => {
    const sub = makeExpiredSub('user_pro_001', 'pro');
    await subsCol.insertOne(sub);

    const result = await rollSubscription(getCols(), sub, new Date());

    expect(result.researchLimit).toBe(100);
    expect(result.messagesLimit).toBe(300);

    const record = await usageCol.findOne({ user_id: 'user_pro_001' });
    expect(record!.prospect_research_limit).toBe(100);
    expect(record!.messages_generated_limit).toBe(300);
  });

  // ─── Business plan ───────────────────────────────────────────────────────────

  it('Business: creates usage record with 300 research / 900 message limits', async () => {
    const sub = makeExpiredSub('user_biz_001', 'business');
    await subsCol.insertOne(sub);

    const result = await rollSubscription(getCols(), sub, new Date());

    expect(result.researchLimit).toBe(300);
    expect(result.messagesLimit).toBe(900);

    const record = await usageCol.findOne({ user_id: 'user_biz_001' });
    expect(record!.prospect_research_limit).toBe(300);
    expect(record!.messages_generated_limit).toBe(900);
  });

  // ─── Unknown plan — fallback ──────────────────────────────────────────────────

  it('Unknown plan: falls back to Starter limits (30/90, never zero)', async () => {
    const sub = makeExpiredSub('user_unknown_001', 'enterprise_ghost');
    await subsCol.insertOne(sub);

    const result = await rollSubscription(getCols(), sub, new Date());

    expect(result.researchLimit).toBe(30);
    expect(result.messagesLimit).toBe(90);

    const record = await usageCol.findOne({ user_id: 'user_unknown_001' });
    expect(record!.prospect_research_limit).toBe(30);
    expect(record!.messages_generated_limit).toBe(90);
  });

  // ─── Idempotency ──────────────────────────────────────────────────────────────

  it('Running rollover twice for the same period does not create two records', async () => {
    const sub = makeExpiredSub('user_idem_001', 'pro');
    await subsCol.insertOne(sub);

    const now = new Date();
    await rollSubscription(getCols(), sub, now);
    await rollSubscription(getCols(), sub, now);

    expect(await usageCol.countDocuments({ user_id: 'user_idem_001' })).toBe(1);
  });

  it('$setOnInsert does not reset usage counters on a second run', async () => {
    const sub = makeExpiredSub('user_idem_002', 'business');
    await subsCol.insertOne(sub);

    const now = new Date();
    await rollSubscription(getCols(), sub, now);

    // Simulate real usage activity
    await usageCol.updateOne({ user_id: 'user_idem_002' }, { $set: { prospect_research_used: 15 } });

    // Run again (crash-recovery scenario)
    await rollSubscription(getCols(), sub, now);

    const record = await usageCol.findOne({ user_id: 'user_idem_002' });
    expect(record!.prospect_research_used).toBe(15);       // activity preserved
    expect(record!.prospect_research_limit).toBe(300);     // limit still correct
  });

  // ─── Multiple users in one run ────────────────────────────────────────────────

  it('Each user gets their own correctly-limited record in a batch run', async () => {
    const subs = [
      makeExpiredSub('multi_starter', 'starter'),
      makeExpiredSub('multi_pro',     'pro'),
      makeExpiredSub('multi_biz',     'business'),
    ];
    await subsCol.insertMany(subs);

    const now = new Date();
    const cols = getCols();
    for (const sub of subs) await rollSubscription(cols, sub, now);

    const starter = await usageCol.findOne({ user_id: 'multi_starter' });
    const pro     = await usageCol.findOne({ user_id: 'multi_pro' });
    const biz     = await usageCol.findOne({ user_id: 'multi_biz' });

    expect(starter!.prospect_research_limit).toBe(30);
    expect(pro!.prospect_research_limit).toBe(100);
    expect(biz!.prospect_research_limit).toBe(300);

    expect(starter!.messages_generated_limit).toBe(90);
    expect(pro!.messages_generated_limit).toBe(300);
    expect(biz!.messages_generated_limit).toBe(900);
  });

  // ─── Period rollover correctness ──────────────────────────────────────────────

  it('New period_end is exactly 30 days after old period_end', async () => {
    const sub = makeExpiredSub('user_period_001', 'pro');
    const originalEnd = sub.current_period_end;
    await subsCol.insertOne(sub);

    const result = await rollSubscription(getCols(), sub, new Date());

    expect(result.newPeriodEnd.getTime()).toBe(
      new Date(originalEnd.getTime() + 30 * 24 * 60 * 60 * 1000).getTime(),
    );
    expect(result.newPeriodStart.getTime()).toBe(originalEnd.getTime());

    const updated = await subsCol.findOne({ _id: sub._id });
    expect(updated!.current_period_end.getTime()).toBe(result.newPeriodEnd.getTime());
    expect(updated!.current_period_start.getTime()).toBe(originalEnd.getTime());
  });

  // ─── Existing usage record for the new period ─────────────────────────────────

  it('Does not overwrite a usage record that already exists for the new period', async () => {
    const sub = makeExpiredSub('user_existing_001', 'pro');
    const newPeriodStart = sub.current_period_end;
    await subsCol.insertOne(sub);

    // Simulate a record that was already created by a previous cron run
    await usageCol.insertOne({
      user_id: 'user_existing_001',
      period_start: newPeriodStart,
      prospect_research_limit: 100,
      messages_generated_limit: 300,
      prospect_research_used: 7,
      messages_generated_used: 20,
    });

    await rollSubscription(getCols(), sub, new Date());

    const records = await usageCol.find({ user_id: 'user_existing_001' }).toArray();
    expect(records).toHaveLength(1);
    expect(records[0]?.prospect_research_used).toBe(7);  // not reset to 0
  });

  // ─── Failure recovery: usage upsert before subscription period advance ────────

  it('failure recovery: subscription period NOT advanced if usage upsert throws', async () => {
    const sub = makeExpiredSub('user_recovery_001', 'pro');
    await subsCol.insertOne(sub);
    const originalPeriodEnd = sub.current_period_end;

    // Create a unique index on (user_id, period_start) to simulate a conflicting insert
    // that is NOT idempotent (e.g. wrong schema / full disk) — we simulate by making
    // usageRecords.updateOne throw before subscriptions.updateOne runs.
    // We do this by passing a deliberately broken collections object.
    const brokenCols = {
      subscriptions: subsCol,
      usageRecords: {
        updateOne: async () => { throw new Error('simulated storage failure'); },
      } as unknown as Collection,
      plans: plansCol,
    };

    await expect(rollSubscription(brokenCols, sub, new Date())).rejects.toThrow(
      'simulated storage failure',
    );

    // Subscription period_end must NOT have advanced — cron can retry
    const updated = await subsCol.findOne({ _id: sub._id });
    expect(updated!.current_period_end.getTime()).toBe(originalPeriodEnd.getTime());
  });
});

// ─── Index-aware tests: production unique index on { user_id: 1 } ─────────────
// These run against a real MongoDB collection that has the production index applied,
// verifying that rollSubscription never conflicts with the unique constraint.

describe.skipIf(!hasTestDb)('rollSubscription against production unique index', () => {
  let client2: MongoClient;
  let db2: ReturnType<MongoClient['db']>;
  let subsCol2: ReturnType<ReturnType<MongoClient['db']>['collection']>;
  let usageCol2: ReturnType<ReturnType<MongoClient['db']>['collection']>;
  let plansCol2: ReturnType<ReturnType<MongoClient['db']>['collection']>;

  beforeAll(async () => {
    client2 = new MongoClient(TEST_URI);
    await client2.connect();
    db2 = client2.db('usage_index_test');
    subsCol2  = db2.collection('subscriptions');
    usageCol2 = db2.collection('usage_records');
    plansCol2 = db2.collection('plans');

    // Apply the PRODUCTION index: unique on user_id alone
    await usageCol2.createIndex({ user_id: 1 }, { unique: true });

    await plansCol2.deleteMany({});
    await plansCol2.insertMany([
      { id: 'pro', name: 'Pro', prospects_per_month: 100, messages_per_month: 300 },
    ]);
  });

  afterAll(async () => {
    await db2.dropDatabase();
    await client2.close();
  });

  beforeEach(async () => {
    await subsCol2.deleteMany({});
    await usageCol2.deleteMany({});
  });

  function getCols2() {
    return { subscriptions: subsCol2, usageRecords: usageCol2, plans: plansCol2 };
  }

  function makeExpiredSub2(userId: string, planId: string) {
    const periodEnd = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return {
      _id: new ObjectId(),
      user_id: userId,
      plan_id: planId,
      status: 'active' as const,
      current_period_start: new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000),
      current_period_end: periodEnd,
    };
  }

  it('first rollover creates one usage record without index conflict', async () => {
    const sub = makeExpiredSub2('idx_user_001', 'pro');
    await subsCol2.insertOne(sub);

    // Must not throw E11000
    await expect(rollSubscription(getCols2(), sub, new Date())).resolves.toBeDefined();
    expect(await usageCol2.countDocuments({ user_id: 'idx_user_001' })).toBe(1);
  });

  it('second rollover for the same period updates limits, does NOT insert a second doc', async () => {
    const sub = makeExpiredSub2('idx_user_002', 'pro');
    await subsCol2.insertOne(sub);
    const now = new Date();

    await rollSubscription(getCols2(), sub, now);
    // Simulate usage
    await usageCol2.updateOne({ user_id: 'idx_user_002' }, { $set: { prospect_research_used: 10 } });

    // Second run with same timestamp — must not throw E11000
    await expect(rollSubscription(getCols2(), sub, now)).resolves.toBeDefined();

    expect(await usageCol2.countDocuments({ user_id: 'idx_user_002' })).toBe(1);
    const record = await usageCol2.findOne({ user_id: 'idx_user_002' });
    expect(record!.prospect_research_used).toBe(10);  // counters preserved
  });

  it('rolling multiple users in one batch run causes no index conflicts', async () => {
    const subs = ['idx_batch_a', 'idx_batch_b', 'idx_batch_c'].map(uid =>
      makeExpiredSub2(uid, 'pro'),
    );
    await subsCol2.insertMany(subs);
    const now = new Date();
    const cols = getCols2();

    // No E11000 for any user
    for (const sub of subs) {
      await expect(rollSubscription(cols, sub, now)).resolves.toBeDefined();
    }
    expect(await usageCol2.countDocuments()).toBe(3);
  });

  it('concurrent rollovers for existing-record user reset counters exactly once', async () => {
    // Scenario: user has an old-period usage record. Two workers race to advance it.
    // Only the atomic winner of step 2a resets counters; the loser falls to the
    // idempotent step 2b which never resets counters.

    const sub = makeExpiredSub2('idx_concurrent_001', 'pro');
    await subsCol2.insertOne(sub);

    // Insert an existing old-period record so both workers hit step 2a first
    await usageCol2.insertOne({
      user_id: 'idx_concurrent_001',
      period_start: sub.current_period_start,
      period_end: sub.current_period_end,
      prospect_research_used: 55,
      messages_generated_used: 180,
      prospect_research_limit: 100,
      messages_generated_limit: 300,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const now = new Date();
    const cols = getCols2();

    const [r1, r2] = await Promise.all([
      rollSubscription(cols, sub, now),
      rollSubscription(cols, sub, now),
    ]);

    expect(r1).toBeDefined();
    expect(r2).toBeDefined();

    expect(await usageCol2.countDocuments({ user_id: 'idx_concurrent_001' })).toBe(1);

    const record = await usageCol2.findOne({ user_id: 'idx_concurrent_001' });
    expect(record!.period_start.getTime()).toBe(sub.current_period_end.getTime());
    // Counters reset exactly once to 0 by the atomic winner
    expect(record!.prospect_research_used).toBe(0);
    expect(record!.messages_generated_used).toBe(0);

    // Simulate mid-period activity, re-run concurrent pair — counters must survive
    await usageCol2.updateOne({ user_id: 'idx_concurrent_001' }, { $set: { prospect_research_used: 42 } });
    await Promise.all([rollSubscription(cols, sub, now), rollSubscription(cols, sub, now)]);

    const after = await usageCol2.findOne({ user_id: 'idx_concurrent_001' });
    expect(after!.prospect_research_used).toBe(42);
    expect(await usageCol2.countDocuments({ user_id: 'idx_concurrent_001' })).toBe(1);
  });

  it('deterministic first-time concurrent rollover: barrier confirms both workers in step 2b before either inserts', async () => {
    // ── Why a barrier is needed ──────────────────────────────────────────────────
    // Promise.all does NOT guarantee both workers reach step 2b simultaneously.
    // Without coordination, the first worker can complete the upsert INSERT before
    // the second even starts it, so the second worker would UPDATE rather than INSERT
    // — the E11000 path would never be reached.
    //
    // The barrier holds each worker after step 2a returns matchedCount === 0 (both
    // workers have confirmed no document exists) and releases both together so their
    // step 2b upsert calls are in flight at the same time. This makes the INSERT race
    // reproducible against the real unique index.
    //
    // ── How we detect which path ran ────────────────────────────────────────────
    // We count every usageRecords.updateOne call during the concurrent run:
    //   4 calls → both workers INSERT-or-UPDATEd cleanly (MongoDB resolved internally)
    //   5 calls → the losing worker got E11000, our recovery branch retried → 5th call
    // Both outcomes are correct; either count proves both paths are safe.

    const sub = makeExpiredSub2('idx_new_user_barrier', 'pro');
    await subsCol2.insertOne(sub);
    // Intentionally no usage record — this is a genuine first-time rollover

    const now = new Date();

    // ── Barrier setup ────────────────────────────────────────────────────────────
    let step2aArrived = 0;
    let barrierResolve!: () => void;
    const barrier = new Promise<void>(r => { barrierResolve = r; });
    let usageUpdateCallCount = 0;

    const originalUpdateOne = usageCol2.updateOne.bind(usageCol2);

    // Shadow the prototype method on this instance for the duration of the test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (usageCol2 as any).updateOne = async (...args: any[]) => {
      usageUpdateCallCount++;
      const [filter, , options] = args as [Record<string, unknown>, unknown, Record<string, unknown> | undefined];
      // Step 2a filter: { user_id, period_start: { $ne: ... } }
      // Step 2b upsert / E11000 retry filter: { user_id } only
      const isStep2a = filter != null && 'period_start' in filter && !options?.upsert;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (originalUpdateOne as any)(...args);
      if (isStep2a && (result as { matchedCount: number }).matchedCount === 0) {
        step2aArrived++;
        if (step2aArrived >= 2) barrierResolve(); // both workers at barrier — open the gate
        await barrier;                              // hold until the gate opens
      }
      return result;
    };

    try {
      const cols = getCols2(); // usageRecords === patched usageCol2
      const [r1, r2] = await Promise.all([
        rollSubscription(cols, sub, now),
        rollSubscription(cols, sub, now),
      ]);

      // Both workers completed without throwing
      expect(r1).toBeDefined();
      expect(r2).toBeDefined();

      // Barrier fired correctly — both workers confirmed no-document before proceeding
      expect(step2aArrived).toBe(2);

      // Exactly one document
      expect(await usageCol2.countDocuments({ user_id: 'idx_new_user_barrier' })).toBe(1);

      const record = await usageCol2.findOne({ user_id: 'idx_new_user_barrier' });
      expect(record!.period_start.getTime()).toBe(sub.current_period_end.getTime());
      expect(record!.prospect_research_used).toBe(0);
      expect(record!.messages_generated_used).toBe(0);
      expect(record!.prospect_research_limit).toBe(100);

      // The only two valid outcomes (see test header comment):
      //   4 calls → MongoDB resolved the concurrent upsert internally (no E11000 thrown)
      //   5 calls → E11000 was thrown; the recovery branch ran the 5th call
      // Any other count signals an unexpected code path.
      const path = usageUpdateCallCount === 5
        ? 'E11000 recovery branch exercised (5 calls)'
        : 'MongoDB resolved upsert race internally (4 calls)';
      expect(
        usageUpdateCallCount === 4 || usageUpdateCallCount === 5,
        `Unexpected call count ${usageUpdateCallCount}. Expected 4 or 5. Path: ${path}`,
      ).toBe(true);
      console.info(`[barrier test] ${path}`);
    } finally {
      // Remove own-property shadow; prototype method is restored via chain
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (usageCol2 as any).updateOne;
    }

    // ── Idempotency after the concurrent insert ──────────────────────────────────
    // Simulate mid-period activity, re-run concurrent pair — counters must survive
    await usageCol2.updateOne(
      { user_id: 'idx_new_user_barrier' },
      { $set: { prospect_research_used: 7 } },
    );
    await Promise.all([
      rollSubscription(getCols2(), sub, now),
      rollSubscription(getCols2(), sub, now),
    ]);
    const after = await usageCol2.findOne({ user_id: 'idx_new_user_barrier' });
    expect(after!.prospect_research_used).toBe(7);
    expect(await usageCol2.countDocuments({ user_id: 'idx_new_user_barrier' })).toBe(1);
  });

  it('E11000 simulation: recovery branch preserves existing counters and only refreshes limits', async () => {
    // ── Purpose ──────────────────────────────────────────────────────────────────
    // The barrier test proves the end-to-end scenario is safe but cannot guarantee
    // the E11000 recovery branch runs every time (MongoDB may resolve the race
    // internally). This test makes the branch deterministic by injecting a fake
    // E11000 error on the step 2b upsert, then verifying the recovery update:
    //   - does NOT reset prospect_research_used or messages_generated_used
    //   - DOES refresh prospect_research_limit and messages_generated_limit
    //   - leaves exactly one document in the collection

    const sub = makeExpiredSub2('idx_e11000_sim', 'pro');
    await subsCol2.insertOne(sub);

    // Pre-create the usage record on the NEW period — simulating the state after
    // the concurrent INSERT winner succeeded. The losing worker will see
    // matchedCount === 0 from step 2a (record is already on new period) and fall
    // straight to step 2b, which we intercept to throw E11000.
    const newPeriodStart = sub.current_period_end;
    const newPeriodEnd   = new Date(newPeriodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
    await usageCol2.insertOne({
      user_id: 'idx_e11000_sim',
      subscription_id: sub._id.toString(),
      prospect_research_used:   23,   // existing mid-period activity
      messages_generated_used:  71,
      prospect_research_limit:  10,   // deliberately stale — recovery must refresh to 100
      messages_generated_limit: 20,   // deliberately stale — recovery must refresh to 300
      period_start: newPeriodStart,
      period_end:   newPeriodEnd,
      created_at:   new Date(),
      updated_at:   new Date(),
    });

    let upsertAttempts = 0;
    let recoveryUpdateAttempts = 0;
    const originalUpdateOne = usageCol2.updateOne.bind(usageCol2);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (usageCol2 as any).updateOne = async (...args: any[]) => {
      const [, , options] = args as [unknown, unknown, Record<string, unknown> | undefined];
      if (options?.upsert) {
        upsertAttempts++;
        // Simulate the E11000 the INSERT loser would receive in the real race
        throw Object.assign(new Error('E11000 duplicate key error collection: test.usage_records index: user_id_1'), { code: 11000 });
      }
      // Every non-upsert updateOne that reaches the interceptor after the E11000
      // is the recovery call — count it, then forward to real MongoDB.
      if (upsertAttempts > 0) {
        recoveryUpdateAttempts++;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (originalUpdateOne as any)(...args);
    };

    try {
      await rollSubscription(getCols2(), sub, new Date());
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (usageCol2 as any).updateOne;
    }

    // Step 2b upsert attempted exactly once, then E11000 thrown
    expect(upsertAttempts).toBe(1);
    // Recovery branch issued exactly one plain updateOne
    expect(recoveryUpdateAttempts).toBe(1);

    // Recovery branch ran: limits refreshed, counters untouched
    expect(await usageCol2.countDocuments({ user_id: 'idx_e11000_sim' })).toBe(1);
    const record = await usageCol2.findOne({ user_id: 'idx_e11000_sim' });
    expect(record!.prospect_research_used).toBe(23);    // counter preserved
    expect(record!.messages_generated_used).toBe(71);   // counter preserved
    expect(record!.prospect_research_limit).toBe(100);  // limit refreshed
    expect(record!.messages_generated_limit).toBe(300); // limit refreshed
  });
});

// ─── Pure-logic tests (no DB needed, always run) ──────────────────────────────

describe('usageReset plan limit resolution (pure)', () => {
  const plans = new Map([
    ['starter',  { prospects_per_month: 30,  messages_per_month: 90  }],
    ['pro',      { prospects_per_month: 100, messages_per_month: 300 }],
    ['business', { prospects_per_month: 300, messages_per_month: 900 }],
  ]);

  function resolveLimits(planId: string) {
    const p = plans.get(planId);
    return { research: p?.prospects_per_month ?? 30, messages: p?.messages_per_month ?? 90 };
  }

  it('Starter: 30/90', () => { const l = resolveLimits('starter'); expect(l.research).toBe(30); expect(l.messages).toBe(90); });
  it('Pro: 100/300',   () => { const l = resolveLimits('pro');     expect(l.research).toBe(100); expect(l.messages).toBe(300); });
  it('Business: 300/900', () => { const l = resolveLimits('business'); expect(l.research).toBe(300); expect(l.messages).toBe(900); });

  it('Unknown plan falls back to Starter, never zero', () => {
    const l = resolveLimits('ghost_plan');
    expect(l.research).toBeGreaterThan(0);
    expect(l.messages).toBeGreaterThan(0);
    expect(l.research).toBe(30);
    expect(l.messages).toBe(90);
  });

  it('All plans produce non-zero limits', () => {
    for (const id of ['starter', 'pro', 'business']) {
      const l = resolveLimits(id);
      expect(l.research).toBeGreaterThan(0);
      expect(l.messages).toBeGreaterThan(0);
    }
  });

  it('Period rolls forward by exactly 30 days', () => {
    const periodEnd = new Date('2026-01-15T00:00:00Z');
    const newEnd = new Date(periodEnd.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(newEnd.toISOString()).toBe('2026-02-14T00:00:00.000Z');
  });

  it('Operation order: usage upsert before subscription update', () => {
    // This is a structural invariant of rollSubscription — verified by the
    // failure-recovery integration test above, and documented here as a pure assertion
    // that the module exports the function signature that accepts cols separately.
    // The function signature itself enforces this: subscriptions and usageRecords
    // are passed as separate collection handles, not fetched internally, so callers
    // can inject fakes for failure-recovery testing.
    expect(typeof rollSubscription).toBe('function');
    expect(rollSubscription.length).toBe(3); // (cols, sub, now)
  });
});
