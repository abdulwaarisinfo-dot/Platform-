export interface BrainExtractionInput {
  raw_text: string;
  existing_facts?: Array<{ category: string; key: string; value: string }>;
}

const SYSTEM = `You are a business intelligence extraction assistant.
Extract structured facts about a business from the provided text.

Output ONLY valid JSON in this exact shape — no markdown, no explanation:
{
  "facts": [
    {
      "category": "service|icp_industry|icp_title|icp_size|pain_point|differentiator|tone",
      "key": "short snake_case identifier",
      "value": "concise factual statement",
      "confidence": "confirmed|inferred"
    }
  ]
}

Rules:
- confidence=confirmed: user explicitly stated it
- confidence=inferred: you deduced it from context
- Extract only facts that are clearly present or strongly implied
- Do not invent or embellish
- If existing_facts are provided, skip duplicates and only add new information
- Allowed categories: service, icp_industry, icp_title, icp_size, pain_point, differentiator, tone`;

export function buildBrainExtractionPrompt(
  input: BrainExtractionInput,
): { system: string; user: string } {
  const existingSection =
    input.existing_facts && input.existing_facts.length > 0
      ? `\n\nExisting facts (do not duplicate):\n${JSON.stringify(input.existing_facts, null, 2)}`
      : '';

  return {
    system: SYSTEM,
    user: `Extract business facts from this text:\n\n${input.raw_text}${existingSection}`,
  };
}
