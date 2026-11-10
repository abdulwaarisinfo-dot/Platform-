import type { BusinessBrainContext } from '@platform/types';

const CHAR_LIMITS: Record<string, string> = {
  linkedin_connection_request: 'Maximum 300 characters. No subject line.',
  linkedin_direct_message: 'Maximum 1000 characters. No subject line.',
  cold_email: 'Include subject line. Body: 150-300 words.',
  short_intro: 'Maximum 100 characters. No subject line.',
  followup_no_response: '100-150 words. No subject line. Reference previous message.',
  followup_after_reply: 'Context-aware response. No subject line. Continue the conversation naturally.',
};

const SYSTEM = `You are an expert B2B outreach copywriter.
Write a highly personalized outreach message based on the prospect research and opportunity analysis.

Output ONLY valid JSON in this exact shape — no markdown, no explanation:
{
  "subject": "email subject line, or null for non-email message types",
  "body": "the message body"
}

Writing rules:
- Lead with something specific to this person or company — not a generic opener
- Reference a concrete detail from their background or recent activity
- Connect your service to their specific situation naturally
- Do not start with "I", "My", "We" or "Hi [name]"
- Avoid buzzwords: synergy, leverage, innovative, game-changing, circle back
- Match the tone described in the business context
- Respect the character/word limits strictly`;

export interface MessageGenerationInput {
  message_type: string;
  prospect: {
    name: string;
    title?: string;
    company?: string;
  };
  opportunity: {
    primary_opportunity: string;
    recommended_angle: string;
    supporting_evidence: string[];
  };
  research: {
    professional_summary: string;
    company_summary: string;
    recent_developments: string[];
    potential_signals: string[];
  };
  business_brain: BusinessBrainContext;
}

export function buildMessageGenerationPrompt(
  input: MessageGenerationInput,
): { system: string; user: string } {
  const limits = CHAR_LIMITS[input.message_type] ?? 'Follow professional norms.';

  const user = `Message type: ${input.message_type}
${limits}

Prospect: ${input.prospect.name}${input.prospect.title ? `, ${input.prospect.title}` : ''}${input.prospect.company ? ` at ${input.prospect.company}` : ''}

Professional background: ${input.research.professional_summary}
Company context: ${input.research.company_summary}
Recent activity: ${input.research.recent_developments.slice(0, 3).join('; ')}
Buying signals: ${input.research.potential_signals.slice(0, 3).join('; ')}

Opportunity: ${input.opportunity.primary_opportunity}
Recommended angle: ${input.opportunity.recommended_angle}
Key evidence: ${input.opportunity.supporting_evidence.slice(0, 2).join('; ')}

Sender's services: ${input.business_brain.services.join(', ')}
Communication tone: ${input.business_brain.communication_tone}

Write the message.`;

  return { system: SYSTEM, user };
}
