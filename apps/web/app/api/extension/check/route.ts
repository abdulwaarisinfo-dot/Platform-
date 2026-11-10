import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { usageRecords } from '@/lib/mongodb/collections';

function getSecret(): Uint8Array {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET environment variable is not configured');
  return new TextEncoder().encode(s);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  let userId: string;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if ((payload as { type?: string }).type !== 'access' || !payload.sub) {
      throw new Error('Invalid token type');
    }
    userId = payload.sub;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const col = await usageRecords();
  const usage = await col.findOne({ user_id: userId });

  const remaining = usage
    ? ((usage.prospect_research_limit as number) ?? 0) - ((usage.prospect_research_used as number) ?? 0)
    : 0;

  return NextResponse.json({
    authenticated: true,
    user_id: userId,
    credits_remaining: remaining,
    can_research: remaining > 0,
  });
}
