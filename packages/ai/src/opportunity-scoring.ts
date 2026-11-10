import { z } from 'zod';
import { getAnthropicClient, MODELS, calculateCost, safeParseJson } from './client';
import { buildOpportunityScoringPrompt, type OpportunityScoringInput } from './prompts/opportunity-scoring';
import type { OpportunityScore } from '@platform/types';

const ScoreSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  relevance_score: z.number().int().min(0).max(100),
  signal_score: z.number().int().min(0).max(100),
  fit_score: z.number().int().min(0).max(100),
  timing_score: z.number().int().min(0).max(100),
  primary_opportunity: z.string(),
  supporting_evidence: z.array(z.string()).default([]),
  weak_points: z.array(z.string()).default([]),
  recommended_angle: z.string(),
  score_explanation: z.string(),
});

export async function scoreOpportunity(input: OpportunityScoringInput): Promise<OpportunityScore> {
  const client = getAnthropicClient();
  const { system, user } = buildOpportunityScoringPrompt(input);

  const response = await client.messages.create({
    model: MODELS.SMART,
    max_tokens: 800,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const content = response.content[0];
  if (content?.type !== 'text') throw new Error('Unexpected AI response type');

  const parsed = safeParseJson<unknown>(content.text);
  if (!parsed) throw new Error('AI returned unparseable JSON for opportunity scoring');

  const validated = ScoreSchema.parse(parsed);
  const cost = calculateCost(MODELS.SMART, response.usage.input_tokens, response.usage.output_tokens);

  return {
    overall_score: validated.overall_score,
    relevance_score: validated.relevance_score,
    signal_score: validated.signal_score,
    fit_score: validated.fit_score,
    timing_score: validated.timing_score,
    primary_opportunity: validated.primary_opportunity,
    supporting_evidence: validated.supporting_evidence.map(point => ({
      point,
      source: null,
      confidence: 'inferred' as const,
    })),
    weak_points: validated.weak_points,
    recommended_angle: validated.recommended_angle,
    score_explanation: validated.score_explanation,
    cost_usd: cost,
    tokens_used: response.usage.input_tokens + response.usage.output_tokens,
  };
}
