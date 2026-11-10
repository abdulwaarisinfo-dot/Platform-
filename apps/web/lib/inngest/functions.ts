import { ObjectId } from 'mongodb';
import { getDb } from '../mongodb';
import { inngest } from '../inngest';
import { rollSubscription } from './rollSubscription';

async function getCol(name: string) {
  return (await getDb()).collection(name);
}

// Fan-out: for each URL in a batch, enqueue an individual processing event
export const processBatch = inngest.createFunction(
  { id: 'process-batch', concurrency: { limit: 5 }, retries: 2 },
  { event: 'batch/process' },
  async ({ event, step }) => {
    const { batch_job_id, user_id } = event.data;
    const jobOid = new ObjectId(batch_job_id as string);

    const urls = await step.run('fetch-urls', async () => {
      const col = await getCol('batch_urls');
      return col.find({ batch_job_id, status: 'queued' }).toArray();
    });

    if (!urls || urls.length === 0) {
      await (await getCol('batch_jobs')).updateOne(
        { _id: jobOid },
        { $set: { status: 'completed', completed_at: new Date() } },
      );
      return { processed: 0 };
    }

    await step.run('mark-processing', async () => {
      await (await getCol('batch_jobs')).updateOne(
        { _id: jobOid },
        { $set: { status: 'running', total_urls: urls.length } },
      );
    });

    await step.sendEvent(
      'fan-out-urls',
      (urls as unknown as Array<{ _id: ObjectId; linkedin_url: string }>).map((u) => ({
        name: 'url/process' as const,
        data: {
          batch_url_id: (u._id as ObjectId).toString(),
          batch_job_id,
          user_id,
          url: u.linkedin_url,
        },
      })),
    );

    return { fanned_out: urls.length };
  },
);

// Process a single URL: claim → quota check → research → upsert prospect
export const processUrl = inngest.createFunction(
  {
    id: 'process-url',
    concurrency: [
      { limit: 10 },
      { key: 'event.data.user_id', limit: 3 },
    ],
    retries: 2,
  },
  { event: 'url/process' },
  async ({ event, step }) => {
    const { batch_url_id, batch_job_id, user_id, url } = event.data;
    const urlOid = new ObjectId(batch_url_id as string);
    const jobOid = new ObjectId(batch_job_id as string);

    const incrementJobCounter = async (
      field: 'completed_count' | 'failed_count' | 'skipped_count',
    ) => {
      await (await getCol('batch_jobs')).updateOne(
        { _id: jobOid },
        { $inc: { [field]: 1 } },
      );
    };

    const job = await step.run('check-cancelled', async () => {
      const col = await getCol('batch_jobs');
      return col.findOne({ _id: jobOid });
    });

    if ((job as { status?: string } | null)?.status === 'cancelled') {
      await (await getCol('batch_urls')).updateOne(
        { _id: urlOid, status: 'queued' },
        { $set: { status: 'skipped', error_message: 'Job cancelled', processing_completed_at: new Date() } },
      );
      await incrementJobCounter('skipped_count');
      return { skipped: true };
    }

    // Idempotent claim: transition from 'queued' to 'in_progress'.
    // If it fails (already claimed by a prior attempt), skip to avoid double-processing.
    const claimed = await step.run('claim-url', async () => {
      const result = await (await getCol('batch_urls')).findOneAndUpdate(
        { _id: urlOid, status: 'queued' },
        { $set: { status: 'in_progress', processing_started_at: new Date() } },
        { returnDocument: 'after' },
      );
      return { claimed: result !== null };
    });

    if (!claimed.claimed) {
      // Already in progress or finished by a prior attempt — do not double-count.
      return { skipped: true, reason: 'already_claimed' };
    }

    // Atomic quota check
    const quotaResult = await step.run('check-quota', async () => {
      const col = await getCol('usage_records');
      const result = await col.findOneAndUpdate(
        {
          user_id,
          $expr: { $lt: ['$prospect_research_used', '$prospect_research_limit'] },
        },
        { $inc: { prospect_research_used: 1 }, $set: { updated_at: new Date() } },
        { returnDocument: 'after' },
      );
      return { allowed: result !== null };
    });

    if (!quotaResult.allowed) {
      await (await getCol('batch_urls')).updateOne(
        { _id: urlOid },
        { $set: { status: 'skipped', error_message: 'Monthly quota exceeded', processing_completed_at: new Date() } },
      );
      await incrementJobCounter('skipped_count');
      return { skipped: true, reason: 'quota' };
    }

    // Check research cache (30-day window)
    const cached = await step.run('check-cache', async () => {
      const normalizedUrl = (url as string).toLowerCase().replace(/\/$/, '');
      const col = await getCol('research_records');
      return col.findOne({
        linkedin_url: normalizedUrl,
        status: 'completed',
        expires_at: { $gte: new Date() },
      });
    });

    if (cached?.prospect_id) {
      // Refund quota — no new research was run
      await (await getCol('usage_records')).updateOne(
        { user_id },
        { $inc: { prospect_research_used: -1 }, $set: { updated_at: new Date() } },
      );
      await (await getCol('batch_urls')).updateOne(
        { _id: urlOid },
        { $set: { status: 'completed', prospect_id: cached.prospect_id as string, processing_completed_at: new Date() } },
      );
      await incrementJobCounter('completed_count');
      return { cached: true, prospect_id: cached.prospect_id };
    }

    // Run the research pipeline via internal API
    const result = await step.run('run-research', async () => {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      try {
        const res = await fetch(`${appUrl}/api/prospects/research-internal`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-inngest-secret': process.env.INNGEST_SIGNING_KEY ?? '',
          },
          body: JSON.stringify({ user_id, linkedin_url: url, source: 'bulk' }),
        });

        if (!res.ok) {
          const text = await res.text();
          return { success: false, error: `HTTP ${res.status}: ${text}` };
        }

        return (await res.json()) as { success: boolean; prospect_id?: string; error?: string };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    });

    if (!result.success || !result.prospect_id) {
      // Refund quota on failure
      await (await getCol('usage_records')).updateOne(
        { user_id },
        { $inc: { prospect_research_used: -1 }, $set: { updated_at: new Date() } },
      );
      await (await getCol('batch_urls')).updateOne(
        { _id: urlOid },
        { $set: { status: 'failed', error_message: result.error ?? 'Research failed', processing_completed_at: new Date() } },
      );
      await incrementJobCounter('failed_count');
      return { failed: true, error: result.error };
    }

    await (await getCol('batch_urls')).updateOne(
      { _id: urlOid },
      { $set: { status: 'completed', prospect_id: result.prospect_id, processing_completed_at: new Date() } },
    );
    await incrementJobCounter('completed_count');

    // Finalize batch atomically: only transition from 'running' once all URLs are accounted for.
    // The $expr guard prevents multiple concurrent completions from each triggering finalization.
    await step.run('maybe-finalize', async () => {
      const col = await getCol('batch_jobs');
      await col.findOneAndUpdate(
        {
          _id: jobOid,
          status: 'running',
          $expr: {
            $gte: [
              { $add: ['$completed_count', '$failed_count', '$skipped_count'] },
              '$total_urls',
            ],
          },
        },
        { $set: { status: 'completed', completed_at: new Date() } },
      );
    });

    return { success: true, prospect_id: result.prospect_id };
  },
);

// Usage-reset cron: replaces the Supabase Edge Function (supabase/functions/usage-reset).
// Runs daily at 00:05 UTC. Finds subscriptions whose current_period_end has passed and
// rolls them forward, creating a fresh usage record for the new billing period.
export const usageReset = inngest.createFunction(
  { id: 'usage-reset', retries: 3 },
  { cron: '5 0 * * *' },
  async ({ step }) => {
    const now = new Date();

    const expired = await step.run('fetch-expired-subscriptions', async () => {
      const col = await getCol('subscriptions');
      return col.find({
        status: { $in: ['active', 'trialing'] },
        current_period_end: { $lt: now },
      }).toArray();
    });

    if (!expired.length) return { rolled: 0 };

    let rolled = 0;
    const errors: string[] = [];

    for (const sub of expired) {
      await step.run(`roll-subscription-${sub._id}`, async () => {
        const db = await getDb();
        try {
          await rollSubscription(
            {
              subscriptions: db.collection('subscriptions'),
              usageRecords: db.collection('usage_records'),
              plans: db.collection('plans'),
            },
            {
              _id: sub._id as unknown as ObjectId,
              user_id: sub.user_id,
              plan_id: sub.plan_id,
              current_period_end: sub.current_period_end as Date,
            },
            now,
          );
          rolled++;
        } catch (err) {
          errors.push(`sub ${sub._id}: ${String(err)}`);
        }
      });
    }

    return { rolled, total: expired.length, errors };
  },
);
