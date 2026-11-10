import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/lib/auth-unified';
import { prospects, researchRecords, businessBrains, brainFacts, opportunityAnalyses, aiCostRecords, toId } from '@/lib/mongodb/collections';
import { scoreOpportunity } from '@platform/ai';
import type { OpportunityScoringInput } from '@platform/ai';
import type { BusinessBrainContext, ResearchPipelineResult } from '@platform/types';

interface Params { params: Promise<{ id: string }> }
function toOid(id: string) { try { return new ObjectId(id); } catch { return null; } }

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const oid = toOid(id);
  if (!oid) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const prospectDoc = await (await prospects()).findOne({ _id: oid, user_id: userId });
  if (!prospectDoc) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const research = await (await researchRecords()).findOne(
    { prospect_id: id, status: 'completed' },
    { sort: { created_at: -1 } }
  );
  if (!research) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Run research first' } }, { status: 400 });
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

  const researchResult = research as unknown as ResearchPipelineResult;
  const input: OpportunityScoringInput = {
    research: researchResult,
    business_brain: brainCtx,
    prospect_name: prospectDoc.full_name as string,
    prospect_title: (prospectDoc.professional_title as string) ?? undefined,
  };

  const result = await scoreOpportunity(input);

  const now = new Date();
  const insertResult = await (await opportunityAnalyses()).insertOne({
    prospect_id: id,
    user_id: userId,
    research_id: research._id.toString(),
    overall_score: result.overall_score,
    relevance_score: result.relevance_score,
    signal_score: result.signal_score,
    fit_score: result.fit_score,
    timing_score: result.timing_score,
    primary_opportunity: result.primary_opportunity,
    supporting_evidence: result.supporting_evidence,
    weak_points: result.weak_points,
    recommended_angle: result.recommended_angle,
    score_explanation: result.score_explanation,
    cost_usd: result.cost_usd,
    tokens_used: result.tokens_used,
    created_at: now,
  });

  if (result.cost_usd > 0) {
    await (await aiCostRecords()).insertOne({
      user_id: userId,
      operation: 'opportunity_scoring',
      model: 'claude-haiku-5-5',
      input_tokens: 0,
      output_tokens: result.tokens_used,
      cost_usd: result.cost_usd,
      created_at: now,
    });
  }

  const doc = await (await opportunityAnalyses()).findOne({ _id: insertResult.insertedId });
  return NextResponse.json({ opportunity: doc ? toId(doc) : null });
}
