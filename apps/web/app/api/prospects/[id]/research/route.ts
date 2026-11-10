import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/lib/auth-unified';
import { prospects, researchRecords, businessBrains, brainFacts, usageRecords, aiCostRecords } from '@/lib/mongodb/collections';
import { executeResearchPipeline } from '@platform/research';
import type { BusinessBrainContext } from '@platform/types';

interface Params { params: Promise<{ id: string }> }

function toOid(id: string) { try { return new ObjectId(id); } catch { return null; } }

async function atomicQuotaCheck(userId: string): Promise<boolean> {
  const col = await usageRecords();
  const result = await col.findOneAndUpdate(
    {
      user_id: userId,
      $expr: { $lt: ['$prospect_research_used', '$prospect_research_limit'] },
    },
    { $inc: { prospect_research_used: 1 }, $set: { updated_at: new Date() } },
    { returnDocument: 'after' }
  );
  return result !== null;
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const oid = toOid(id);
  if (!oid) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const prospectDoc = await (await prospects()).findOne({ _id: oid, user_id: userId });
  if (!prospectDoc) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  // 30-day cache check
  const cacheExpiry = new Date();
  cacheExpiry.setDate(cacheExpiry.getDate() - 30);
  const cached = await (await researchRecords()).findOne(
    { prospect_id: id, status: 'completed', created_at: { $gte: cacheExpiry } },
    { sort: { created_at: -1 } }
  );

  if (cached) {
    return NextResponse.json({
      research_id: cached._id.toString(),
      status: 'completed',
      input_mode: cached.input_mode,
      enrichment_confidence: cached.enrichment_confidence ?? 'web_only',
      enrichment_matched: cached.enrichment_matched,
      professional_summary: cached.professional_summary ?? '',
      company_summary: cached.company_summary ?? '',
      recent_developments: (cached.recent_developments as string[]) ?? [],
      potential_signals: (cached.potential_signals as string[]) ?? [],
      confidence: cached.confidence ?? 'low',
      gaps: (cached.gaps as string[]) ?? [],
      sources: (cached.sources as unknown[]) ?? [],
      cached: true,
      cost_usd: 0,
    });
  }

  // Atomic quota check
  const allowed = await atomicQuotaCheck(userId);
  if (!allowed) {
    return NextResponse.json(
      { error: { code: 'USAGE_LIMIT_EXCEEDED', message: 'Monthly research quota reached' } },
      { status: 402 }
    );
  }

  // Brain context
  const brain = await (await businessBrains()).findOne({ user_id: userId, is_active: true });
  const defaultBrain: BusinessBrainContext = {
    services: [], icp_industries: [], icp_company_sizes: [], icp_job_titles: [],
    pain_points: [], differentiators: [], communication_tone: 'professional',
  };

  let brainCtx = defaultBrain;
  if (brain) {
    const facts = await (await brainFacts()).find({ brain_id: brain._id.toString(), is_active: true }).toArray();
    if (facts.length) {
      const f = facts as unknown as Array<{ category: string; value: string }>;
      brainCtx = {
        services: f.filter(x => x.category === 'service').map(x => x.value),
        icp_industries: f.filter(x => x.category === 'icp_industry').map(x => x.value),
        icp_company_sizes: f.filter(x => x.category === 'icp_size').map(x => x.value),
        icp_job_titles: f.filter(x => x.category === 'icp_title').map(x => x.value),
        pain_points: f.filter(x => x.category === 'pain_point').map(x => x.value),
        differentiators: f.filter(x => x.category === 'differentiator').map(x => x.value),
        communication_tone: f.find(x => x.category === 'tone')?.value ?? 'professional',
      };
    }
  }

  // Create a pending research record
  const now = new Date();
  const rrCol = await researchRecords();
  const rrResult = await rrCol.insertOne({
    prospect_id: id,
    user_id: userId,
    status: 'running',
    input_mode: prospectDoc.linkedin_url ? 'linkedin_url' : 'manual',
    linkedin_url: prospectDoc.linkedin_url ?? null,
    created_at: now,
  });

  try {
    const pipelineResult = await executeResearchPipeline({
      prospect_id: id,
      user_id: userId,
      input_mode: prospectDoc.linkedin_url ? 'linkedin_url' : 'manual',
      full_name: prospectDoc.full_name as string,
      company_name: (prospectDoc.company_name as string) ?? undefined,
      job_title: (prospectDoc.professional_title as string) ?? undefined,
      linkedin_url: (prospectDoc.linkedin_url as string) ?? undefined,
      user_bio: (prospectDoc.user_provided_bio as string) ?? undefined,
      business_brain: brainCtx,
    });

    await rrCol.updateOne(
      { _id: rrResult.insertedId },
      {
        $set: {
          status: 'completed',
          enrichment_matched: pipelineResult.enrichment_matched,
          enrichment_confidence: pipelineResult.enrichment_confidence,
          professional_summary: pipelineResult.professional_summary,
          company_summary: pipelineResult.company_summary,
          recent_developments: pipelineResult.recent_developments,
          potential_signals: pipelineResult.potential_signals,
          confidence: pipelineResult.confidence,
          gaps: pipelineResult.gaps,
          sources: pipelineResult.sources,
          cost_usd: pipelineResult.cost_usd,
          tokens_used: pipelineResult.tokens_used,
          cached: false,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }
    );

    await (await prospects()).updateOne(
      { _id: oid },
      { $set: { status: 'researched', last_activity_at: new Date(), updated_at: new Date() } }
    );

    if (pipelineResult.cost_usd > 0) {
      await (await aiCostRecords()).insertOne({
        user_id: userId,
        operation: 'prospect_research',
        model: 'mixed',
        input_tokens: 0,
        output_tokens: pipelineResult.tokens_used ?? 0,
        cost_usd: pipelineResult.cost_usd,
        created_at: new Date(),
      });
    }

    return NextResponse.json({
      research_id: rrResult.insertedId.toString(),
      status: 'completed',
      ...pipelineResult,
      cached: false,
    });
  } catch (err) {
    await rrCol.updateOne(
      { _id: rrResult.insertedId },
      { $set: { status: 'failed' } }
    );
    // Refund the quota on failure
    await (await usageRecords()).updateOne(
      { user_id: userId },
      { $inc: { prospect_research_used: -1 }, $set: { updated_at: new Date() } }
    );
    console.error('Research pipeline failed:', err);
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Research failed' } }, { status: 500 });
  }
}
