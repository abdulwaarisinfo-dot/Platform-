import type { Collection, ObjectId } from 'mongodb';

export interface RollResult {
  researchLimit: number;
  messagesLimit: number;
  newPeriodStart: Date;
  newPeriodEnd: Date;
}

export interface RollCols {
  subscriptions: Collection;
  usageRecords: Collection;
  plans: Collection;
}

/**
 * Roll a subscription forward by one billing period and upsert a fresh usage record.
 *
 * Operation order is intentional for failure-recovery and concurrency correctness:
 *  1. Look up plan limits (read-only, safe to repeat on retry)
 *  2. Atomically transition usage record from old period to new period
 *  3. Advance the subscription's current_period_end
 *
 * Concurrency safety (step 2):
 *   The first updateOne filter is { user_id, period_start: { $ne: newPeriodStart } }.
 *   MongoDB holds a document-level lock for each updateOne, so only ONE concurrent
 *   caller can win this transition — the winner sets period_start = newPeriodStart,
 *   subsequent callers find matchedCount === 0 and fall through to the idempotent branch.
 *
 * If step 2 throws, step 3 has not run. The cron will retry and step 2 is idempotent.
 * If step 3 throws after step 2 succeeded, the next retry re-runs step 2 as a no-op.
 */
export async function rollSubscription(
  cols: RollCols,
  sub: {
    _id: ObjectId;
    user_id: unknown;
    plan_id: unknown;
    current_period_end: Date;
  },
  now: Date,
): Promise<RollResult> {
  const newPeriodStart = sub.current_period_end;
  const newPeriodEnd = new Date(sub.current_period_end.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Step 1: resolve plan limits
  const plan = await cols.plans.findOne({ id: sub.plan_id as string });
  const researchLimit = (plan?.prospects_per_month as number | undefined) ?? 30;
  const messagesLimit = (plan?.messages_per_month as number | undefined) ?? 90;

  // Step 2: atomically transition usage record to the new billing period.
  //
  // The production index is { user_id: 1 } unique (one active record per user).
  //
  // 2a. Try to transition the record FROM an old period TO the new period.
  //     The filter { period_start: { $ne: newPeriodStart } } only matches a record
  //     that has NOT yet been advanced. MongoDB's document-level lock means only ONE
  //     concurrent caller can win this — the winner resets counters and advances
  //     period_start; all subsequent callers find matchedCount === 0 and skip to 2b.
  //
  // 2b. When 2a matched nothing (record already on new period, or new user):
  //     Upsert on user_id alone. For an existing record on the new period, $set
  //     refreshes limits without touching counters. For a brand-new user, $setOnInsert
  //     initialises counters to 0. Neither path can conflict with the unique index.
  const rollResult = await cols.usageRecords.updateOne(
    { user_id: sub.user_id as string, period_start: { $ne: newPeriodStart } },
    {
      $set: {
        user_id: sub.user_id,
        subscription_id: sub._id.toString(),
        prospect_research_used: 0,
        messages_generated_used: 0,
        prospect_research_limit: researchLimit,
        messages_generated_limit: messagesLimit,
        period_start: newPeriodStart,
        period_end: newPeriodEnd,
        updated_at: now,
      },
    },
  );

  if (rollResult.matchedCount === 0) {
    // Record is already on new period (concurrent winner or retry) OR new user.
    // $set refreshes limits; $setOnInsert initialises counters only on INSERT (new user).
    //
    // E11000 edge case — two concurrent first-time rollovers, no document yet:
    //   Both workers miss step 2a (nothing to transition). Both fall here and both
    //   call findOne→no-match→INSERT. Worker A wins; Worker B gets E11000.
    //   On E11000 we retry as a plain update: the document now exists on the new
    //   period, so we refresh limits only — counters must NOT be reset.
    try {
      await cols.usageRecords.updateOne(
        { user_id: sub.user_id as string },
        {
          $set: {
            prospect_research_limit: researchLimit,
            messages_generated_limit: messagesLimit,
            updated_at: now,
          },
          $setOnInsert: {
            user_id: sub.user_id,
            subscription_id: sub._id.toString(),
            prospect_research_used: 0,
            messages_generated_used: 0,
            period_start: newPeriodStart,
            period_end: newPeriodEnd,
            created_at: now,
          },
        },
        { upsert: true },
      );
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000) {
        // The concurrent insert won — document exists. Refresh limits, leave counters alone.
        await cols.usageRecords.updateOne(
          { user_id: sub.user_id as string },
          {
            $set: {
              prospect_research_limit: researchLimit,
              messages_generated_limit: messagesLimit,
              updated_at: now,
            },
          },
        );
      } else {
        throw err;
      }
    }
  }

  // Step 3: advance subscription period (only after usage record is confirmed)
  await cols.subscriptions.updateOne(
    { _id: sub._id },
    {
      $set: {
        current_period_start: newPeriodStart,
        current_period_end: newPeriodEnd,
        updated_at: now,
      },
    },
  );

  return { researchLimit, messagesLimit, newPeriodStart, newPeriodEnd };
}
