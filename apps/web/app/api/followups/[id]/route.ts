import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/lib/auth-unified';
import { followups, toId } from '@/lib/mongodb/collections';

function toOid(id: string) { try { return new ObjectId(id); } catch { return null; } }

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const oid = toOid(id);
  if (!oid) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  let body: Partial<{ due_at: string; note: string | null; completed_at: string | null }>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON' } }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (body.due_at !== undefined) updates.due_at = new Date(body.due_at);
  if (body.note !== undefined) updates.note = body.note;
  if (body.completed_at !== undefined) updates.completed_at = body.completed_at ? new Date(body.completed_at) : null;

  const result = await (await followups()).findOneAndUpdate(
    { _id: oid, user_id: userId },
    { $set: updates },
    { returnDocument: 'after' },
  );

  if (!result) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  return NextResponse.json({ followup: toId(result) });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const oid = toOid(id);
  if (!oid) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const result = await (await followups()).deleteOne({ _id: oid, user_id: userId });
  if (result.deletedCount === 0) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  return NextResponse.json({ deleted: true });
}
