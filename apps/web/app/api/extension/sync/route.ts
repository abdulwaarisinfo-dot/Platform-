import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { users, usageRecords, prospects, toIds } from '@/lib/mongodb/collections';

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
  let userEmail: string;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if ((payload as { type?: string }).type !== 'access' || !payload.sub) {
      throw new Error('Invalid token type');
    }
    userId = payload.sub;
    userEmail = (payload as { email?: string }).email ?? '';
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [userDoc, usage, recentDocs] = await Promise.all([
    (await users()).findOne({ email: userEmail }),
    (await usageRecords()).findOne({ user_id: userId }),
    (await prospects()).find({ user_id: userId, archived_at: null })
      .sort({ created_at: -1 })
      .limit(5)
      .toArray(),
  ]);

  const remaining = usage
    ? ((usage.prospect_research_limit as number) ?? 0) - ((usage.prospect_research_used as number) ?? 0)
    : 0;

  const recentProspects = toIds(recentDocs).map(p => ({
    id: p.id,
    full_name: p.full_name,
    company_name: p.company_name,
    job_title: p.professional_title,
    linkedin_url: p.linkedin_url,
    created_at: p.created_at,
  }));

  return NextResponse.json({
    user: {
      id: userId,
      email: userEmail,
      full_name: userDoc?.name ?? null,
    },
    credits_remaining: remaining,
    recent_prospects: recentProspects,
  });
}
