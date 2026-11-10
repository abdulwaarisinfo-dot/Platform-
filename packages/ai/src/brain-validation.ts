import { z } from 'zod';
import { getAnthropicClient, MODELS, calculateCost, safeParseJson } from './client';
import type { BusinessBrainContext, BrainValidationResult } from '@platform/types';

const ValidationSchema = z.object({
  completeness_score: z.number().int().min(0).max(100),
  critical_gaps: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
  ready_for_research: z.boolean(),
});

const SYSTEM = `You are a business profile completeness evaluator.
Assess whether the provided business profile has enough detail to generate high-quality prospect research.

Output ONLY valid JSON:
{
  "completeness_score": 0-100,
  "critical_gaps": ["list of missing critical information"],
  "suggestions": ["specific improvements to add"],
  "ready_for_research": true|false
}

A profile is ready_for_research when score >= 60 AND it has at least: a service, an ICP industry or title, and one pain point.`;

export async function validateBrain(brain: BusinessBrainContext): Promise<BrainValidationResult> {
  const client = getAnthropicClient();

  const user = `Evaluate this business profile:
Services: ${brain.services.join(', ') || 'None'}
Target Industries: ${brain.icp_industries.join(', ') || 'None'}
Target Job Titles: ${brain.icp_job_titles.join(', ') || 'None'}
Target Company Sizes: ${brain.icp_company_sizes.join(', ') || 'None'}
Pain Points Addressed: ${brain.pain_points.join(', ') || 'None'}
Differentiators: ${brain.differentiators.join(', ') || 'None'}
Communication Tone: ${brain.communication_tone || 'Not specified'}`;

  const response = await client.messages.create({
    model: MODELS.FAST,
    max_tokens: 400,
    system: SYSTEM,
    messages: [{ role: 'user', content: user }],
  });

  const content = response.content[0];
  if (content?.type !== 'text') throw new Error('Unexpected AI response type');

  const parsed = safeParseJson<unknown>(content.text);
  if (!parsed) throw new Error('AI returned unparseable JSON for brain validation');

  const validated = ValidationSchema.parse(parsed);
  const cost = calculateCost(MODELS.FAST, response.usage.input_tokens, response.usage.output_tokens);

  return {
    completeness_score: validated.completeness_score,
    critical_gaps: validated.critical_gaps,
    suggestions: validated.suggestions,
    ready_for_research: validated.ready_for_research,
    cost_usd: cost,
    tokens_used: response.usage.input_tokens + response.usage.output_tokens,
  };
}
