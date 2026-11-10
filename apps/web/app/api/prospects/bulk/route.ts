import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-unified';
import { subscriptions, batchJobs, batchUrls, toIds } from '@/lib/mongodb/collections';
import { inngest } from '@/lib/inngest';

const MAX_URLS_PRO = 50;
const MAX_URLS_BUSINESS = 100;
const LINKEDIN_RE = /^https?:\/\/(www\.)?linkedin\.com\/in\/[^/?#]+\/?/i;

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const sub = await (await subscriptions()).findOne({ user_id: userId, status: 'active' });
  const planId = sub?.plan_id ?? 'starter';
  if (planId === 'starter') {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Bulk upload requires Pro or Business plan' } }, { status: 403 });
  }

  const maxUrls = planId === 'business' ? MAX_URLS_BUSINESS : MAX_URLS_PRO;

  let body: { urls?: string[]; name?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON' } }, { status: 400 });
  }

  const rawUrls = (body.urls ?? []).map(u => u.trim()).filter(Boolean);
  if (rawUrls.length === 0) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'No URLs provided' } }, { status: 400 });
  if (rawUrls.length > maxUrls) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: `Maximum ${maxUrls} URLs per batch on your plan` } }, { status: 400 });
  }

  const validUrls = rawUrls.filter(u => LINKEDIN_RE.test(u));
  const invalidCount = rawUrls.length - validUrls.length;
  if (validUrls.length === 0) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'No valid LinkedIn URLs found' } }, { status: 400 });

  const now = new Date();
  const jobsCol = await batchJobs();
  const jobResult = await jobsCol.insertOne({
    user_id: userId,
    name: body.name ?? `Batch ${new Date().toLocaleDateString()}`,
    status: 'pending',
    total_urls: validUrls.length,
    completed_count: 0,
    failed_count: 0,
    skipped_count: 0,
    created_at: now,
  });

  const urlDocs = validUrls.map(url => {
    const normalized = url.toLowerCase().replace(/\/$/, '');
    return {
      batch_job_id: jobResult.insertedId.toString(),
      user_id: userId,
      linkedin_url: normalized,
      normalized_url: normalized,
      status: 'queued' as const,
      created_at: now,
    };
  });

  await (await batchUrls()).insertMany(urlDocs);

  await inngest.send({
    name: 'batch/process',
    data: { batch_job_id: jobResult.insertedId.toString(), user_id: userId },
  });

  return NextResponse.json(
    { batch_job_id: jobResult.insertedId.toString(), queued: validUrls.length, invalid_skipped: invalidCount },
    { status: 202 },
  );
}

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const jobs = await (await batchJobs())
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .limit(20)
    .toArray();

  return NextResponse.json({ jobs: toIds(jobs) });
}
