import { z } from 'zod';
import { getAnthropicClient, MODELS, calculateCost, safeParseJson } from './client';
import { buildMessageGenerationPrompt, type MessageGenerationInput } from './prompts/message-generation';
import type { OutreachMessage } from '@platform/types';

const MessageSchema = z.object({
  subject: z.string().nullable().default(null),
  body: z.string(),
});

const CHAR_LIMITS: Record<string, number> = {
  linkedin_connection_request: 300,
  linkedin_direct_message: 1000,
  cold_email: 2000,
  short_intro: 100,
  followup_no_response: 700,
  followup_after_reply: 1000,
};

export async function generateMessage(input: MessageGenerationInput): Promise<OutreachMessage> {
  const client = getAnthropicClient();
  const { system, user } = buildMessageGenerationPrompt(input);

  const response = await client.messages.create({
    model: MODELS.FAST,
    max_tokens: 600,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const content = response.content[0];
  if (content?.type !== 'text') throw new Error('Unexpected AI response type');

  const parsed = safeParseJson<unknown>(content.text);
  if (!parsed) throw new Error('AI returned unparseable JSON for message generation');

  const validated = MessageSchema.parse(parsed);
  const cost = calculateCost(MODELS.FAST, response.usage.input_tokens, response.usage.output_tokens);
  const charLimit = CHAR_LIMITS[input.message_type] ?? 2000;

  return {
    subject: validated.subject,
    body: validated.body.slice(0, charLimit),
    message_type: input.message_type,
    character_count: validated.body.length,
    cost_usd: cost,
    tokens_used: response.usage.input_tokens + response.usage.output_tokens,
  };
}

export async function rewriteMessage(
  original: string,
  instruction: string,
  messageType: string,
): Promise<OutreachMessage> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: MODELS.FAST,
    max_tokens: 600,
    system: 'Rewrite the message per the instruction. Output ONLY valid JSON: {"subject": null, "body": "rewritten message"}',
    messages: [{
      role: 'user',
      content: `Original message:\n${original}\n\nInstruction: ${instruction}`,
    }],
  });

  const content = response.content[0];
  if (content?.type !== 'text') throw new Error('Unexpected AI response type');

  const parsed = safeParseJson<unknown>(content.text);
  if (!parsed) throw new Error('AI returned unparseable JSON for message rewrite');

  const validated = MessageSchema.parse(parsed);
  const cost = calculateCost(MODELS.FAST, response.usage.input_tokens, response.usage.output_tokens);
  const charLimit = CHAR_LIMITS[messageType] ?? 2000;

  return {
    subject: validated.subject,
    body: validated.body.slice(0, charLimit),
    message_type: messageType,
    character_count: validated.body.length,
    cost_usd: cost,
    tokens_used: response.usage.input_tokens + response.usage.output_tokens,
  };
}
