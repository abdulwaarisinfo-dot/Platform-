import type { ResearchSynthesisInput } from '@platform/types';

const SYSTEM = `You are a B2B research analyst helping a salesperson understand a prospect before outreach.
Synthesize all available information into a structured professional profile.

Output ONLY valid JSON in this exact shape — no markdown, no explanation:
{
  "professional_summary": "2-3 sentence bio focusing on current role and expertise",
  "company_summary": "1-2 sentence company context including size, industry, recent activity",
  "recent_developments": ["array of recent news, changes, or events about person or company"],
  "potential_signals": ["array of buying signals that relate to the seller's services"],
  "confidence": "high|medium|low",
  "gaps": ["things we don't know that would be important for outreach"]
}

Confidence levels:
- high: enrichment data matched + multiple corroborating sources
- medium: web search only, good coverage
- low: limited data, mostly inferred`;

export function buildResearchSynthesisPrompt(
  input: ResearchSynthesisInput,
): { system: string; user: string } {
  const enrichmentSection = input.enrichment_data?.matched
    ? `\n\n## Enrichment Data (verified)\n${JSON.stringify(input.enrichment_data, null, 2)}`
    : '';

  const searchSection =
    input.search_results.length > 0
      ? `\n\n## Web Search Results\n${input.search_results
          .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}${r.date ? ` (${r.date})` : ''}`)
          .join('\n\n')}`
      : '';

  const brainSection = `\n\n## Seller's Business Context\nServices: ${input.business_brain.services.join(', ')}\nICP Industries: ${input.business_brain.icp_industries.join(', ')}\nICP Job Titles: ${input.business_brain.icp_job_titles.join(', ')}\nICP Company Sizes: ${input.business_brain.icp_company_sizes.join(', ')}\nPain Points Addressed: ${input.business_brain.pain_points.join(', ')}\nKey Differentiators: ${input.business_brain.differentiators.join(', ')}`;

  const user = `Prospect: ${input.prospect_name}${input.prospect_title ? `, ${input.prospect_title}` : ''}${input.prospect_company ? ` at ${input.prospect_company}` : ''}
Input mode: ${input.input_mode}${enrichmentSection}${searchSection}${brainSection}

Synthesize all available information into the required JSON structure.`;

  return { system: SYSTEM, user };
}
