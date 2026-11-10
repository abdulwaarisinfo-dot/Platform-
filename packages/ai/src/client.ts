import Anthropic from '@anthropic-ai/sdk';
import { TASK_MODEL_MAP, calculateTokenCost } from '@platform/types';

// ── Singleton client for internal package use ─────────────────────────────────
let _singleton: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_singleton) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    _singleton = new Anthropic({ apiKey });
  }
  return _singleton;
}

export const MODELS = {
  FAST: 'claude-haiku-5-5',
  SMART: 'claude-sonnet-5-5',
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  return calculateTokenCost(model, inputTokens, outputTokens);
}

export function safeParseJson<T>(text: string): T | null {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

export interface AICompleteParams {
  task: string;
  system: string;
  user: string;
  max_tokens?: number;
  temperature?: number;
}

export interface AICompleteResult {
  content: string;
  model_used: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface AIClient {
  complete(params: AICompleteParams): Promise<AICompleteResult>;
}

export function createAIClient(apiKey: string): AIClient {
  const anthropic = new Anthropic({ apiKey });

  return {
    async complete(params) {
      const model = TASK_MODEL_MAP[params.task] ?? 'claude-sonnet-5-5';
      const max_tokens = params.max_tokens ?? 4096;

      const response = await anthropic.messages.create({
        model,
        max_tokens,
        system: params.system,
        messages: [{ role: 'user', content: params.user }],
        ...(params.temperature !== undefined && { temperature: params.temperature }),
      });

      const content =
        response.content[0]?.type === 'text' ? response.content[0].text : '';

      const input_tokens = response.usage.input_tokens;
      const output_tokens = response.usage.output_tokens;
      const cost_usd = calculateTokenCost(model, input_tokens, output_tokens);

      return { content, model_used: model, input_tokens, output_tokens, cost_usd };
    },
  };
}
