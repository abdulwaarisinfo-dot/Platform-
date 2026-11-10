import type { Collection } from 'mongodb';

export type ClaimResult = 'claimed' | 'already_processed' | 'processing_in_progress';

// 5-minute stale-processing threshold: if an event has been 'processing' for longer
// than this, the prior worker likely crashed and the event can be re-claimed.
export const STALE_PROCESSING_MS = 5 * 60 * 1000;

/**
 * Atomically claim a webhook event for processing.
 *
 * Inserts or updates the event document to status='processing', subject to:
 *  - No existing document (first delivery)
 *  - Existing document with status='failed' (retry)
 *  - Existing document with status='processing' and received_at older than STALE_PROCESSING_MS
 *
 * If the event is already 'completed', returns 'already_processed'.
 * If another worker holds a fresh 'processing' claim, returns 'processing_in_progress'.
 *
 * extraFields are stored alongside the base event fields (e.g. event_type, payload).
 */
export async function claimWebhookEvent(
  eventsCol: Collection,
  eventId: string,
  now: Date,
  extraFields: Record<string, unknown> = {},
): Promise<ClaimResult> {
  const staleThreshold = new Date(now.getTime() - STALE_PROCESSING_MS);

  let doc: Record<string, unknown> | null;
  try {
    doc = await eventsCol.findOneAndUpdate(
      {
        event_id: eventId,
        $or: [
          { status: { $exists: false } },
          { status: 'failed' },
          { status: 'processing', received_at: { $lt: staleThreshold } },
        ],
      },
      {
        $set: {
          event_id: eventId,
          ...extraFields,
          status: 'processing',
          received_at: now,
        },
      },
      { upsert: true, returnDocument: 'after' },
    ) as Record<string, unknown> | null;
  } catch (err: unknown) {
    // E11000: two simultaneous deliveries raced to insert; the other worker won the claim
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: number }).code === 11000
    ) {
      const existing = await eventsCol.findOne({ event_id: eventId });
      if (existing?.status === 'completed') return 'already_processed';
      return 'processing_in_progress';
    }
    throw err;
  }

  if (!doc) {
    const existing = await eventsCol.findOne({ event_id: eventId });
    if (existing?.status === 'completed') return 'already_processed';
    return 'processing_in_progress';
  }

  return 'claimed';
}
