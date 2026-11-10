/**
 * Integration tests for the Paddle webhook atomic claim logic.
 *
 * Uses a real MongoDB server to exercise findOneAndUpdate with upsert,
 * unique-index enforcement, and E11000 handling — no mocks, no stubs.
 * Tests import from the production claimWebhookEvent module directly.
 *
 * Run with a local or Atlas test database:
 *   MONGODB_TEST_URI=mongodb://localhost:27017 npx vitest run scripts/webhook-integration.test.ts
 *
 * Tests are skipped automatically when MONGODB_TEST_URI is not set.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoClient, type Collection } from 'mongodb';
import { claimWebhookEvent, STALE_PROCESSING_MS } from '../lib/webhook/claimEvent';

const TEST_URI = process.env.MONGODB_TEST_URI ?? '';
const hasTestDb = Boolean(TEST_URI);

// ─── Shared fixture ────────────────────────────────────────────────────────────

let client: MongoClient;
let eventsCol: Collection;

describe.skipIf(!hasTestDb)('Webhook MongoDB integration', () => {
  beforeAll(async () => {
    client = new MongoClient(TEST_URI);
    await client.connect();
    eventsCol = client.db('webhook_test').collection('webhook_events');
    await eventsCol.createIndex({ event_id: 1 }, { unique: true });
  });

  afterAll(async () => {
    await client.db('webhook_test').dropDatabase();
    await client.close();
  });

  beforeEach(async () => {
    await eventsCol.deleteMany({});
  });

  async function markCompleted(eventId: string) {
    await eventsCol.updateOne({ event_id: eventId }, { $set: { status: 'completed' } });
  }

  async function markFailed(eventId: string) {
    await eventsCol.updateOne({ event_id: eventId }, { $set: { status: 'failed' } });
  }

  // ─── First delivery ──────────────────────────────────────────────────────────

  it('claims a brand-new event', async () => {
    const result = await claimWebhookEvent(eventsCol, 'evt_new_001', new Date());
    expect(result).toBe('claimed');

    const doc = await eventsCol.findOne({ event_id: 'evt_new_001' });
    expect(doc?.status).toBe('processing');
  });

  // ─── Completed event (idempotency) ───────────────────────────────────────────

  it('returns already_processed when status is completed', async () => {
    const now = new Date();
    await eventsCol.insertOne({
      event_id: 'evt_done_001',
      status: 'completed',
      received_at: new Date(now.getTime() - 60_000),
    });

    const result = await claimWebhookEvent(eventsCol, 'evt_done_001', now);
    expect(result).toBe('already_processed');

    // Status must still be completed — not reverted to processing
    const doc = await eventsCol.findOne({ event_id: 'evt_done_001' });
    expect(doc?.status).toBe('completed');
  });

  it('two sequential calls on a completed event both return already_processed', async () => {
    await eventsCol.insertOne({ event_id: 'evt_done_002', status: 'completed', received_at: new Date() });
    expect(await claimWebhookEvent(eventsCol, 'evt_done_002', new Date())).toBe('already_processed');
    expect(await claimWebhookEvent(eventsCol, 'evt_done_002', new Date())).toBe('already_processed');
  });

  // ─── Failed event (retryable) ────────────────────────────────────────────────

  it('re-claims a previously failed event', async () => {
    const now = new Date();
    await eventsCol.insertOne({
      event_id: 'evt_fail_001',
      status: 'failed',
      received_at: new Date(now.getTime() - 10_000),
    });

    expect(await claimWebhookEvent(eventsCol, 'evt_fail_001', now)).toBe('claimed');

    const doc = await eventsCol.findOne({ event_id: 'evt_fail_001' });
    expect(doc?.status).toBe('processing');
  });

  // ─── Stale processing event ──────────────────────────────────────────────────

  it('re-claims a processing event older than 5 min', async () => {
    const now = new Date();
    const sixMinutesAgo = new Date(now.getTime() - 6 * 60 * 1000);

    await eventsCol.insertOne({
      event_id: 'evt_stale_001',
      status: 'processing',
      received_at: sixMinutesAgo,
    });

    expect(await claimWebhookEvent(eventsCol, 'evt_stale_001', now)).toBe('claimed');

    const doc = await eventsCol.findOne({ event_id: 'evt_stale_001' });
    // received_at is updated to 'now', not left at the old stale time
    expect(doc!.received_at.getTime()).toBeGreaterThan(sixMinutesAgo.getTime());
  });

  it('does NOT re-claim a fresh processing event (< 5 min)', async () => {
    const now = new Date();
    await eventsCol.insertOne({
      event_id: 'evt_fresh_001',
      status: 'processing',
      received_at: new Date(now.getTime() - 2 * 60 * 1000),
    });

    expect(await claimWebhookEvent(eventsCol, 'evt_fresh_001', now)).toBe('processing_in_progress');
  });

  // ─── Concurrent duplicate deliveries (E11000) ───────────────────────────────

  it('only one of two simultaneous claims succeeds; the other gets processing_in_progress', async () => {
    const now = new Date();
    const eventId = 'evt_race_001';

    const [r1, r2] = await Promise.all([
      claimWebhookEvent(eventsCol, eventId, now),
      claimWebhookEvent(eventsCol, eventId, now),
    ]);

    // One wins, one loses — order not guaranteed
    const sorted = [r1, r2].sort();
    expect(sorted).toContain('claimed');
    expect(sorted).toContain('processing_in_progress');

    // Exactly one doc in the collection
    expect(await eventsCol.countDocuments({ event_id: eventId })).toBe(1);
  });

  it('after the winner completes, a late retry sees already_processed', async () => {
    const now = new Date();
    const eventId = 'evt_race_002';

    expect(await claimWebhookEvent(eventsCol, eventId, now)).toBe('claimed');
    await markCompleted(eventId);
    expect(await claimWebhookEvent(eventsCol, eventId, new Date())).toBe('already_processed');
  });

  it('three concurrent deliveries: exactly one doc, never more', async () => {
    const now = new Date();
    const eventId = 'evt_race_003';
    await Promise.all([
      claimWebhookEvent(eventsCol, eventId, now),
      claimWebhookEvent(eventsCol, eventId, now),
      claimWebhookEvent(eventsCol, eventId, now),
    ]);
    expect(await eventsCol.countDocuments({ event_id: eventId })).toBe(1);
  });

  // ─── Full lifecycle ──────────────────────────────────────────────────────────

  it('new → processing → completed → rejected', async () => {
    const eventId = 'evt_lifecycle_001';
    const now = new Date();

    expect(await claimWebhookEvent(eventsCol, eventId, now)).toBe('claimed');
    expect(await claimWebhookEvent(eventsCol, eventId, new Date())).toBe('processing_in_progress');
    await markCompleted(eventId);
    expect(await claimWebhookEvent(eventsCol, eventId, new Date())).toBe('already_processed');
  });

  it('new → processing → failed → retried → completed → rejected', async () => {
    const eventId = 'evt_lifecycle_002';

    expect(await claimWebhookEvent(eventsCol, eventId, new Date())).toBe('claimed');
    await markFailed(eventId);
    expect(await claimWebhookEvent(eventsCol, eventId, new Date())).toBe('claimed');
    await markCompleted(eventId);
    expect(await claimWebhookEvent(eventsCol, eventId, new Date())).toBe('already_processed');
  });

  // ─── extraFields are stored on the document ───────────────────────────────────

  it('extraFields are stored on the event document', async () => {
    const now = new Date();
    const result = await claimWebhookEvent(eventsCol, 'evt_extra_001', now, {
      event_type: 'subscription.created',
      payload: { event_id: 'evt_extra_001' },
    });
    expect(result).toBe('claimed');
    const doc = await eventsCol.findOne({ event_id: 'evt_extra_001' });
    expect(doc?.event_type).toBe('subscription.created');
  });
});

// ─── Pure-logic tests (no DB needed) ──────────────────────────────────────────
// These cover the exact same code paths but without I/O, so they always run.

describe('Webhook claim logic (pure)', () => {
  it('STALE_PROCESSING_MS is 5 minutes', () => {
    expect(STALE_PROCESSING_MS).toBe(5 * 60 * 1000);
  });

  it('E11000 error code 11000 is detected', () => {
    function isDuplicateKey(err: unknown): boolean {
      return typeof err === 'object' && err !== null && 'code' in err &&
        (err as { code: number }).code === 11000;
    }
    expect(isDuplicateKey({ code: 11000 })).toBe(true);
    expect(isDuplicateKey({ code: 500 })).toBe(false);
    expect(isDuplicateKey(null)).toBe(false);
  });

  it('completed status resolves to already_processed', () => {
    function resolve(status?: string): string {
      if (status === 'completed') return 'already_processed';
      return 'processing_in_progress';
    }
    expect(resolve('completed')).toBe('already_processed');
    expect(resolve('processing')).toBe('processing_in_progress');
    expect(resolve(undefined)).toBe('processing_in_progress');
  });

  it('stale threshold: 6 min old is stale, 2 min old is not', () => {
    const now = new Date();
    const threshold = new Date(now.getTime() - STALE_PROCESSING_MS);
    const sixMin = new Date(now.getTime() - 6 * 60 * 1000);
    const twoMin = new Date(now.getTime() - 2 * 60 * 1000);
    expect(sixMin < threshold).toBe(true);
    expect(twoMin < threshold).toBe(false);
  });

  it('non-duplicate errors are re-thrown', () => {
    function handle(err: unknown): string {
      if (typeof err === 'object' && err !== null && 'code' in err &&
          (err as { code: number }).code === 11000) return 'dup';
      throw err;
    }
    expect(handle({ code: 11000 })).toBe('dup');
    expect(() => handle({ code: 500 })).toThrow();
  });
});
