import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-unified';
import { businessBrains, brainFacts, aiCostRecords } from '@/lib/mongodb/collections';
import { validateBrain } from '@platform/ai';
import type { BusinessBrainContext } from '@platform/types';

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const brainsCol = await businessBrains();
  const brain = await brainsCol.findOne({ user_id: userId, is_active: true });
  if (!brain) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'No business brain found' } }, { status: 404 });
  }

  const factsArr = await (await brainFacts())
    .find({ brain_id: brain._id.toString(), is_active: true })
    .toArray();

  const brainCtx: BusinessBrainContext = {
    services: factsArr.filter(f => f.category === 'service').map(f => f.value as string),
    icp_industries: factsArr.filter(f => f.category === 'icp' && (f.key as string).includes('industry')).map(f => f.value as string),
    icp_company_sizes: factsArr.filter(f => f.category === 'icp' && (f.key as string).includes('size')).map(f => f.value as string),
    icp_job_titles: factsArr.filter(f => f.category === 'icp' && (f.key as string).includes('title')).map(f => f.value as string),
    pain_points: factsArr.filter(f => f.category === 'problems').map(f => f.value as string),
    differentiators: factsArr.filter(f => f.category === 'positioning').map(f => f.value as string),
    communication_tone: (factsArr.find(f => f.category === 'tone')?.value as string) ?? 'professional',
  };

  const result = await validateBrain(brainCtx);
  const now = new Date();

  await brainsCol.updateOne(
    { _id: brain._id },
    { $set: { completeness_score: result.completeness_score, updated_at: now } },
  );

  if (result.cost_usd > 0) {
    await (await aiCostRecords()).insertOne({
      user_id: userId,
      operation: 'brain_extraction',
      model: 'claude-haiku-5-5',
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: result.cost_usd,
      created_at: now,
    });
  }

  return NextResponse.json({
    completeness_score: result.completeness_score,
    critical_gaps: result.critical_gaps,
    suggestions: result.suggestions,
    ready_for_research: result.ready_for_research,
  });
}
