import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/lib/auth-unified';
import { batchJobs, batchUrls, toId, toIds } from '@/lib/mongodb/collections';

function toOid(id: string) { try { return new ObjectId(id); } catch { return null; } }

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;
  const oid = toOid(batchId);
  if (!oid) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const job = await (await batchJobs()).findOne({ _id: oid, user_id: userId });
  if (!job) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const urls = await (await batchUrls())
    .find({ batch_job_id: batchId })
    .sort({ created_at: 1 })
    .toArray();

  return NextResponse.json({ job: toId(job), urls: toIds(urls) });
}
