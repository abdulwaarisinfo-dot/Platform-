import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/lib/auth-unified';
import { followups, prospects, toId } from '@/lib/mongodb/collections';

function toOid(id: string) { try { return new ObjectId(id); } catch { return null; } }

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'pending';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);
  const prospectId = searchParams.get('prospect_id');

  const filter: Record<string, unknown> = { user_id: userId };
  if (prospectId) filter.prospect_id = prospectId;
  if (status === 'pending') filter.completed_at = null;
  else if (status === 'completed') filter.completed_at = { $ne: null };

  const col = await followups();
  const docs = await col.find(filter).sort({ due_at: 1 }).limit(limit).toArray();

  // Enrich with prospect info
  const prospectIds = [...new Set(docs.map(d => d.prospect_id as string))];
  const prospectDocs = prospectIds.length
    ? await (await prospects()).find({
        _id: { $in: prospectIds.map(id => toOid(id)).filter(Boolean) as ObjectId[] },
      }).toArray()
    : [];
  const prospectMap = new Map(prospectDocs.map(p => [p._id.toString(), p]));

  const enriched = docs.map(d => ({
    ...toId(d),
    prospect: prospectMap.get(d.prospect_id as string)
      ? toId(prospectMap.get(d.prospect_id as string)!)
      : null,
  }));

  return NextResponse.json({ followups: enriched });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  let body: { prospect_id: string; due_at: string; note?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON' } }, { status: 400 });
  }

  if (!body.prospect_id || !body.due_at) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'prospect_id and due_at required' } }, { status: 400 });
  }

  const prospectOid = toOid(body.prospect_id);
  if (!prospectOid) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const prospect = await (await prospects()).findOne({ _id: prospectOid, user_id: userId });
  if (!prospect) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const now = new Date();
  const result = await (await followups()).insertOne({
    user_id: userId,
    prospect_id: body.prospect_id,
    due_at: new Date(body.due_at),
    note: body.note ?? null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  });

  const doc = await (await followups()).findOne({ _id: result.insertedId });
  return NextResponse.json({ followup: doc ? toId(doc) : null }, { status: 201 });
}
