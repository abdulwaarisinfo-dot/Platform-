import { z } from 'zod';
import { getAnthropicClient, MODELS, calculateCost, safeParseJson } from './client';
import { buildBrainExtractionPrompt, type BrainExtractionInput } from './prompts/brain-extraction';

const FactSchema = z.object({
  category: z.string(),
  key: z.string(),
  value: z.string(),
  confidence: z.enum(['confirmed', 'inferred']),
});

const ExtractionSchema = z.object({
  facts: z.array(FactSchema).default([]),
});

export interface BrainExtractionOutput {
  facts: Array<{
    category: string;
    key: string;
    value: string;
    confidence: 'confirmed' | 'inferred';
  }>;
  cost_usd: number;
  tokens_used: number;
}

export async function extractBrainFacts(input: BrainExtractionInput): Promise<BrainExtractionOutput> {
  const client = getAnthropicClient();
  const { system, user } = buildBrainExtractionPrompt(input);

  const response = await client.messages.create({
    model: MODELS.FAST,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const content = response.content[0];
  if (content?.type !== 'text') throw new Error('Unexpected AI response type');

  const parsed = safeParseJson<unknown>(content.text);
  if (!parsed) throw new Error('AI returned unparseable JSON for brain extraction');

  const validated = ExtractionSchema.parse(parsed);
  const cost = calculateCost(MODELS.FAST, response.usage.input_tokens, response.usage.output_tokens);

  return {
    facts: validated.facts,
    cost_usd: cost,
    tokens_used: response.usage.input_tokens + response.usage.output_tokens,
  };
}
