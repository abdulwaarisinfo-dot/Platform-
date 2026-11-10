import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/lib/auth-unified';
import { prospects, opportunityAnalyses, researchRecords, businessBrains, brainFacts, generatedMessages, usageRecords, aiCostRecords, toIds, toId } from '@/lib/mongodb/collections';
import { generateMessage } from '@platform/ai';
import type { MessageGenerationInput } from '@platform/ai';
import type { BusinessBrainContext } from '@platform/types';

interface Params { params: Promise<{ id: string }> }
function toOid(id: string) { try { return new ObjectId(id); } catch { return null; } }

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const docs = await (await generatedMessages()).find({ prospect_id: id, user_id: userId })
    .sort({ created_at: -1 })
    .toArray();

  return NextResponse.json({ messages: toIds(docs) });
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const oid = toOid(id);
  if (!oid) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const body = await request.json() as {
    message_type?: string;
    connection_status?: string;
    opportunity_id?: string;
    conversation_context?: string;
  };

  if (!body.message_type || !body.opportunity_id) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'message_type and opportunity_id are required' } }, { status: 400 });
  }

  const prospectDoc = await (await prospects()).findOne({ _id: oid, user_id: userId });
  if (!prospectDoc) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const oppOid = toOid(body.opportunity_id);
  if (!oppOid) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Opportunity analysis not found' } }, { status: 404 });

  const opp = await (await opportunityAnalyses()).findOne({ _id: oppOid, user_id: userId });
  if (!opp) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Opportunity analysis not found' } }, { status: 404 });

  // Check message quota
  const usageDoc = await (await usageRecords()).findOneAndUpdate(
    {
      user_id: userId,
      $expr: { $lt: ['$messages_generated_used', '$messages_generated_limit'] },
    },
    { $inc: { messages_generated_used: 1 }, $set: { updated_at: new Date() } },
    { returnDocument: 'after' }
  );
  if (!usageDoc) {
    return NextResponse.json({ error: { code: 'USAGE_LIMIT_EXCEEDED', message: 'Monthly message quota reached' } }, { status: 402 });
  }

  // Research context
  const research = await (await researchRecords()).findOne(
    { prospect_id: id, status: 'completed' },
    { sort: { created_at: -1 } }
  );

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

  const msgInput: MessageGenerationInput = {
    message_type: body.message_type,
    prospect: {
      name: prospectDoc.full_name as string,
      title: (prospectDoc.professional_title as string) ?? undefined,
      company: (prospectDoc.company_name as string) ?? undefined,
    },
    research: {
      professional_summary: (research?.professional_summary as string) ?? '',
      company_summary: (research?.company_summary as string) ?? '',
      recent_developments: (research?.recent_developments as string[]) ?? [],
      potential_signals: (research?.potential_signals as string[]) ?? [],
    },
    opportunity: {
      primary_opportunity: opp.primary_opportunity as string,
      recommended_angle: opp.recommended_angle as string,
      supporting_evidence: (opp.supporting_evidence as unknown as Array<{ point: string }>)?.map(e => e.point) ?? [],
    },
    business_brain: brainCtx,
  };

  const result = await generateMessage(msgInput);

  const now = new Date();
  const msgResult = await (await generatedMessages()).insertOne({
    prospect_id: id,
    user_id: userId,
    opportunity_id: body.opportunity_id,
    message_type: body.message_type,
    subject: result.subject ?? null,
    body: result.body,
    version: 1,
    parent_id: null,
    modification_type: null,
    character_count: result.character_count,
    is_saved: false,
    copied_at: null,
    sent_at: null,
    cost_usd: result.cost_usd,
    tokens_used: result.tokens_used,
    created_at: now,
  });

  if (result.cost_usd > 0) {
    await (await aiCostRecords()).insertOne({
      user_id: userId,
      operation: 'message_generation',
      model: 'claude-haiku-5-5',
      input_tokens: 0,
      output_tokens: result.tokens_used,
      cost_usd: result.cost_usd,
      created_at: now,
    });
  }

  const doc = await (await generatedMessages()).findOne({ _id: msgResult.insertedId });
  return NextResponse.json({ message: doc ? toId(doc) : null }, { status: 201 });
}
