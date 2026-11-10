import { z } from 'zod';
import { getAnthropicClient, MODELS, calculateCost, safeParseJson } from './client';
import { buildResearchSynthesisPrompt } from './prompts/research-synthesis';
import type { ResearchSynthesisInput, SynthesisResult } from '@platform/types';

const SynthesisSchema = z.object({
  professional_summary: z.string(),
  company_summary: z.string(),
  recent_developments: z.array(z.string()).default([]),
  potential_signals: z.array(z.string()).default([]),
  confidence: z.enum(['high', 'medium', 'low']),
  gaps: z.array(z.string()).default([]),
});

export async function synthesizeResearch(input: ResearchSynthesisInput): Promise<SynthesisResult> {
  const client = getAnthropicClient();
  const { system, user } = buildResearchSynthesisPrompt(input);

  const response = await client.messages.create({
    model: MODELS.SMART,
    max_tokens: 1000,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const content = response.content[0];
  if (content?.type !== 'text') throw new Error('Unexpected AI response type');

  const parsed = safeParseJson<unknown>(content.text);
  if (!parsed) throw new Error('AI returned unparseable JSON for synthesis');

  const validated = SynthesisSchema.parse(parsed);
  const cost = calculateCost(MODELS.SMART, response.usage.input_tokens, response.usage.output_tokens);

  return {
    professional_summary: validated.professional_summary,
    company_summary: validated.company_summary,
    recent_developments: validated.recent_developments.map(d => ({ description: d })),
    potential_signals: validated.potential_signals,
    confidence: validated.confidence,
    gaps: validated.gaps,
    cost_usd: cost,
    tokens_used: response.usage.input_tokens + response.usage.output_tokens,
  };
}
