import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-unified';
import { prospects, toIds } from '@/lib/mongodb/collections';
import { normalizeLinkedInUrl } from '@platform/research';

const VALID_STATUSES = ['new', 'researched', 'ready', 'sent', 'replied', 'not_interested', 'converted'] as const;
type ProspectStatus = typeof VALID_STATUSES[number];

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20'));
  const status = searchParams.get('status');
  const search = searchParams.get('q');
  const offset = (page - 1) * limit;

  const filter: Record<string, unknown> = { user_id: userId, archived_at: null };

  const validatedStatus = status && (VALID_STATUSES as readonly string[]).includes(status)
    ? (status as ProspectStatus)
    : null;
  if (validatedStatus) filter.status = validatedStatus;

  if (search) {
    filter.$or = [
      { full_name: { $regex: search, $options: 'i' } },
      { company_name: { $regex: search, $options: 'i' } },
    ];
  }

  const col = await prospects();
  const [docs, total] = await Promise.all([
    col.find(filter).sort({ created_at: -1 }).skip(offset).limit(limit).toArray(),
    col.countDocuments(filter),
  ]);

  return NextResponse.json({
    prospects: toIds(docs),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const body = await request.json() as {
    full_name?: string;
    company_name?: string;
    professional_title?: string;
    linkedin_url?: string;
    company_website?: string;
    user_provided_bio?: string;
  };

  if (!body.full_name?.trim()) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'full_name is required' } }, { status: 400 });
  }

  let linkedinUrl: string | null = null;
  if (body.linkedin_url) {
    linkedinUrl = normalizeLinkedInUrl(body.linkedin_url);
    if (!linkedinUrl) {
      return NextResponse.json({ error: { code: 'INVALID_LINKEDIN_URL' } }, { status: 400 });
    }
  }

  const now = new Date();
  const col = await prospects();
  const result = await col.insertOne({
    user_id: userId,
    full_name: body.full_name.trim(),
    company_name: body.company_name ?? null,
    professional_title: body.professional_title ?? null,
    linkedin_url: linkedinUrl,
    company_website: body.company_website ?? null,
    user_provided_bio: body.user_provided_bio ?? null,
    status: 'new',
    connection_status: null,
    notes: null,
    tags: [],
    last_activity_at: null,
    next_followup_at: null,
    archived_at: null,
    created_at: now,
    updated_at: now,
  });

  const doc = await col.findOne({ _id: result.insertedId });
  return NextResponse.json({ prospect: doc ? { ...doc, id: doc._id.toString() } : null }, { status: 201 });
}
