import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-unified';
import { businessBrains, brainFacts, toId, toIds } from '@/lib/mongodb/collections';

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const brain = await (await businessBrains()).findOne({ user_id: userId, is_active: true });
  if (!brain) return NextResponse.json({ brain: null, facts: [] });

  const facts = await (await brainFacts())
    .find({ brain_id: brain._id.toString(), is_active: true })
    .sort({ category: 1 })
    .toArray();

  return NextResponse.json({ brain: toId(brain), facts: toIds(facts) });
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const body = await request.json() as { name?: string; description?: string; website_url?: string };

  const now = new Date();
  const brainsCol = await businessBrains();

  // Deactivate existing brain
  await brainsCol.updateMany({ user_id: userId, is_active: true }, { $set: { is_active: false, updated_at: now } });

  const result = await brainsCol.insertOne({
    user_id: userId,
    name: body.name ?? null,
    description: body.description ?? null,
    website_url: body.website_url ?? null,
    completeness_score: 0,
    is_active: true,
    created_at: now,
    updated_at: now,
  });

  const doc = await brainsCol.findOne({ _id: result.insertedId });
  return NextResponse.json({ brain: doc ? toId(doc) : null, facts: [] }, { status: 201 });
}
