import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/lib/auth-unified';
import { batchJobs, batchUrls } from '@/lib/mongodb/collections';

function toOid(id: string) { try { return new ObjectId(id); } catch { return null; } }

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;
  const oid = toOid(batchId);
  if (!oid) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const jobsCol = await batchJobs();
  const job = await jobsCol.findOne({ _id: oid, user_id: userId });
  if (!job) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  if (!['pending', 'running'].includes(job.status as string)) {
    return NextResponse.json({ error: { code: 'CONFLICT', message: 'Job cannot be cancelled in its current state' } }, { status: 400 });
  }

  const now = new Date();
  await jobsCol.updateOne({ _id: oid }, { $set: { status: 'cancelled', completed_at: now } });
  await (await batchUrls()).updateMany(
    { batch_job_id: batchId, status: 'queued' },
    { $set: { status: 'skipped', error_message: 'Job cancelled' } },
  );

  return NextResponse.json({ cancelled: true });
}
