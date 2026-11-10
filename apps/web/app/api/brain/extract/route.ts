import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-unified';
import { businessBrains, brainFacts, aiCostRecords, toId, toIds } from '@/lib/mongodb/collections';
import { extractBrainFacts } from '@platform/ai';
import type { BrainExtractionInput } from '@platform/ai';

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const userId = session.user.id;

  const body = await request.json() as { text?: string; source_type?: string };
  if (!body.text?.trim()) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'text is required' } }, { status: 400 });
  }

  const brainsCol = await businessBrains();
  const factsCol = await brainFacts();
  const now = new Date();

  // Get or create brain
  let brain = await brainsCol.findOne({ user_id: userId, is_active: true });
  if (!brain) {
    const r = await brainsCol.insertOne({
      user_id: userId, completeness_score: 0, is_active: true, created_at: now, updated_at: now,
    });
    brain = await brainsCol.findOne({ _id: r.insertedId });
  }
  if (!brain) return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });

  const brainId = brain._id.toString();

  const existingFacts = await factsCol.find({ brain_id: brainId, is_active: true }).toArray();

  const extractionInput: BrainExtractionInput = {
    raw_text: body.text,
    existing_facts: existingFacts.map(f => ({
      category: f.category as string,
      key: f.key as string,
      value: f.value as string,
    })),
  };
  const extraction = await extractBrainFacts(extractionInput);

  if (extraction.facts.length > 0) {
    await factsCol.insertMany(extraction.facts.map(f => ({
      brain_id: brainId,
      user_id: userId,
      category: f.category,
      key: f.key,
      value: f.value,
      confidence: f.confidence,
      is_active: true,
      created_at: now,
    })));
  }

  const categories = new Set(extraction.facts.map(f => f.category));
  const score = Math.min(100, (categories.size / 7) * 100);

  await brainsCol.updateOne({ _id: brain._id }, { $set: { completeness_score: score, updated_at: now } });

  if (extraction.cost_usd > 0) {
    await (await aiCostRecords()).insertOne({
      user_id: userId,
      operation: 'brain_extraction',
      model: 'claude-haiku-5-5',
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: extraction.cost_usd,
      created_at: now,
    });
  }

  const allFacts = await factsCol.find({ brain_id: brainId, is_active: true }).toArray();
  const updatedBrain = await brainsCol.findOne({ _id: brain._id });

  return NextResponse.json({
    brain: updatedBrain ? toId(updatedBrain) : null,
    facts: toIds(allFacts),
    extracted_count: extraction.facts.length,
    cost_usd: extraction.cost_usd,
  });
}
