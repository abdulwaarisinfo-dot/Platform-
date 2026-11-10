import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getSession } from '@/lib/auth-unified';
import { prospects, researchRecords, opportunityAnalyses, generatedMessages, toId, toIds } from '@/lib/mongodb/collections';

const PatchBodySchema = z.object({
  status: z.enum(['new', 'researched', 'ready', 'sent', 'replied', 'not_interested', 'converted']).optional(),
  connection_status: z.enum(['connected', 'not_connected', 'pending', 'replied']).nullable().optional(),
  notes: z.string().nullable().optional(),
  tags: z.unknown().optional(),
  next_followup_at: z.string().datetime().nullable().optional(),
}).strict();

interface Params {
  params: Promise<{ id: string }>;
}

function toOid(id: string) {
  try { return new ObjectId(id); } catch { return null; }
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const oid = toOid(id);
  if (!oid) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const col = await prospects();
  const prospect = await col.findOne({ _id: oid, user_id: userId });
  if (!prospect) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const [researchDoc, opportunityDoc, messageDocs] = await Promise.all([
    (await researchRecords()).findOne(
      { prospect_id: id, status: 'completed' },
      { sort: { created_at: -1 } }
    ),
    (await opportunityAnalyses()).findOne(
      { prospect_id: id },
      { sort: { created_at: -1 } }
    ),
    (await generatedMessages()).find({ prospect_id: id, user_id: userId })
      .sort({ created_at: -1 })
      .limit(20)
      .toArray(),
  ]);

  return NextResponse.json({
    prospect: toId(prospect),
    research: researchDoc ? toId(researchDoc) : null,
    opportunity: opportunityDoc ? toId(opportunityDoc) : null,
    messages: toIds(messageDocs),
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const oid = toOid(id);
  if (!oid) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  let rawBody: unknown;
  try { rawBody = await request.json(); } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON' } }, { status: 400 });
  }

  const parsed = PatchBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', issues: parsed.error.issues } }, { status: 400 });
  }

  const body = parsed.data;
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (body.status !== undefined) updates.status = body.status;
  if ('connection_status' in body) updates.connection_status = body.connection_status ?? null;
  if ('notes' in body) updates.notes = body.notes ?? null;
  if ('tags' in body) updates.tags = body.tags;
  if ('next_followup_at' in body) updates.next_followup_at = body.next_followup_at ? new Date(body.next_followup_at) : null;

  const col = await prospects();
  const result = await col.findOneAndUpdate(
    { _id: oid, user_id: userId },
    { $set: updates },
    { returnDocument: 'after' }
  );

  if (!result) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  return NextResponse.json({ prospect: toId(result) });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const oid = toOid(id);
  if (!oid) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const col = await prospects();
  const result = await col.updateOne(
    { _id: oid, user_id: userId },
    { $set: { archived_at: new Date(), updated_at: new Date() } }
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
