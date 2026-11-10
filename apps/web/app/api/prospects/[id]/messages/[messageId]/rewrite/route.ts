import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/lib/auth-unified';
import { generatedMessages, aiCostRecords, toId } from '@/lib/mongodb/collections';
import { rewriteMessage } from '@platform/ai';
import type { MessageType } from '@platform/types';

interface Params { params: Promise<{ id: string; messageId: string }> }
function toOid(id: string) { try { return new ObjectId(id); } catch { return null; } }

export async function POST(request: Request, { params }: Params) {
  const { id, messageId } = await params;
  const msgOid = toOid(messageId);
  if (!msgOid) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const body = await request.json() as { modification?: string };
  if (!body.modification) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'modification is required' } }, { status: 400 });
  }

  const col = await generatedMessages();
  const original = await col.findOne({ _id: msgOid, prospect_id: id, user_id: userId });
  if (!original) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const rewritten = await rewriteMessage(
    original.body as string,
    body.modification,
    original.message_type as MessageType
  );

  const now = new Date();
  const result = await col.insertOne({
    prospect_id: id,
    user_id: userId,
    opportunity_id: original.opportunity_id,
    message_type: original.message_type,
    subject: original.subject ?? null,
    body: rewritten.body,
    version: ((original.version as number) ?? 1) + 1,
    parent_id: original._id.toString(),
    modification_type: body.modification,
    character_count: rewritten.character_count,
    is_saved: false,
    copied_at: null,
    sent_at: null,
    cost_usd: rewritten.cost_usd,
    tokens_used: rewritten.tokens_used,
    created_at: now,
  });

  if (rewritten.cost_usd > 0) {
    await (await aiCostRecords()).insertOne({
      user_id: userId,
      operation: 'message_rewrite',
      model: 'claude-haiku-5-5',
      input_tokens: 0,
      output_tokens: rewritten.tokens_used,
      cost_usd: rewritten.cost_usd,
      created_at: now,
    });
  }

  const doc = await col.findOne({ _id: result.insertedId });
  return NextResponse.json({ message: doc ? toId(doc) : null }, { status: 201 });
}
