import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-unified';
import { businessBrains, brainFacts, toIds } from '@/lib/mongodb/collections';

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const brain = await (await businessBrains()).findOne({ user_id: userId, is_active: true });
  if (!brain) return NextResponse.json({ facts: [] });

  const facts = await (await brainFacts())
    .find({ brain_id: brain._id.toString(), is_active: true })
    .sort({ category: 1 })
    .toArray();

  return NextResponse.json({ facts: toIds(facts) });
}
