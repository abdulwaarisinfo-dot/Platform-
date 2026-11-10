import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/lib/auth-unified';
import { brainFacts, toId } from '@/lib/mongodb/collections';

interface Params { params: Promise<{ id: string }> }
function toOid(id: string) { try { return new ObjectId(id); } catch { return null; } }

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const oid = toOid(id);
  if (!oid) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const body = await request.json() as { value?: string; confidence?: 'confirmed' | 'inferred' };
  if (!body.value?.trim()) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'value is required' } }, { status: 400 });
  }

  const col = await brainFacts();
  const result = await col.findOneAndUpdate(
    { _id: oid, user_id: userId },
    { $set: { value: body.value, confidence: body.confidence ?? 'confirmed', updated_at: new Date() } },
    { returnDocument: 'after' },
  );

  if (!result) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  return NextResponse.json({ fact: toId(result) });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const oid = toOid(id);
  if (!oid) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const result = await (await brainFacts()).updateOne(
    { _id: oid, user_id: userId },
    { $set: { is_active: false, updated_at: new Date() } },
  );

  if (result.matchedCount === 0) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  return new Response(null, { status: 204 });
}
