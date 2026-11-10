import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-unified';
import { usageRecords, subscriptions, toId } from '@/lib/mongodb/collections';

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const [usage, sub] = await Promise.all([
    (await usageRecords()).findOne({ user_id: userId }),
    (await subscriptions()).findOne({ user_id: userId, status: 'active' }),
  ]);

  return NextResponse.json({
    usage: usage ? toId(usage) : null,
    subscription: sub ? toId(sub) : null,
  });
}
