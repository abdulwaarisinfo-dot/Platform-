/**
 * Internal endpoint called by Inngest processUrl function.
 * Authenticated via x-inngest-secret header (not user JWT).
 */
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { prospects, researchRecords } from '@/lib/mongodb/collections';
import { executeResearchPipeline, normalizeLinkedInUrl } from '@platform/research';

export async function POST(request: Request) {
  const secret = request.headers.get('x-inngest-secret');
  if (!secret || secret !== process.env.INNGEST_SIGNING_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as { user_id: string; linkedin_url: string; source?: string };
  const { user_id, linkedin_url } = body;

  if (!user_id || !linkedin_url) {
    return NextResponse.json({ error: 'Missing user_id or linkedin_url' }, { status: 400 });
  }

  const normalized = normalizeLinkedInUrl(linkedin_url);
  if (!normalized) return NextResponse.json({ success: false, error: 'Invalid LinkedIn URL' });

  const prospectsCol = await prospects();
  const rrCol = await researchRecords();

  // Find or create prospect
  let prospectId: string;
  const existing = await prospectsCol.findOne({ user_id, linkedin_url: normalized });

  if (existing) {
    prospectId = existing._id.toString();
  } else {
    const slug = normalized.split('/in/')[1]?.replace(/\/$/, '') ?? '';
    const displayName = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const created = await prospectsCol.insertOne({
      user_id,
      full_name: displayName || 'Unknown',
      linkedin_url: normalized,
      status: 'new',
      created_at: new Date(),
    });
    prospectId = created.insertedId.toString();
  }

  const rrResult = await rrCol.insertOne({
    prospect_id: prospectId,
    user_id,
    status: 'running',
    input_mode: 'linkedin_url',
    linkedin_url: normalized,
    cached: false,
    created_at: new Date(),
  });

  try {
    const prospectDoc = await prospectsCol.findOne({ _id: new ObjectId(prospectId) });

    const result = await executeResearchPipeline({
      prospect_id: prospectId,
      user_id,
      input_mode: 'linkedin_url',
      full_name: (prospectDoc?.full_name as string) ?? '',
      company_name: (prospectDoc?.company_name as string) ?? undefined,
      job_title: (prospectDoc?.professional_title as string) ?? undefined,
      linkedin_url: normalized,
      business_brain: {
        services: [], icp_industries: [], icp_company_sizes: [], icp_job_titles: [],
        pain_points: [], differentiators: [], communication_tone: 'professional',
      },
    });

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await rrCol.updateOne(
      { _id: rrResult.insertedId },
      {
        $set: {
          status: 'completed',
          enrichment_matched: result.enrichment_matched,
          enrichment_confidence: result.enrichment_confidence,
          professional_summary: result.professional_summary,
          company_summary: result.company_summary,
          recent_developments: result.recent_developments,
          potential_signals: result.potential_signals,
          confidence: result.confidence,
          gaps: result.gaps,
          sources: result.sources,
          cost_usd: result.cost_usd,
          tokens_used: result.tokens_used,
          expires_at: expiresAt,
        },
      },
    );

    await prospectsCol.updateOne(
      { _id: new ObjectId(prospectId) },
      { $set: { status: 'researched', last_activity_at: new Date() } },
    );

    return NextResponse.json({ success: true, prospect_id: prospectId });
  } catch (err) {
    await rrCol.updateOne({ _id: rrResult.insertedId }, { $set: { status: 'failed' } });
    return NextResponse.json({ success: false, error: (err as Error).message });
  }
}
