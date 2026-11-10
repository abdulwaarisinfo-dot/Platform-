import type { ResearchPipelineResult, BusinessBrainContext } from '@platform/types';

const SYSTEM = `You are a B2B sales opportunity analyst.
Score this prospect opportunity across four dimensions based on available research.

Output ONLY valid JSON in this exact shape — no markdown, no explanation:
{
  "overall_score": 0-100,
  "relevance_score": 0-100,
  "signal_score": 0-100,
  "fit_score": 0-100,
  "timing_score": 0-100,
  "primary_opportunity": "one clear sentence describing the main opportunity",
  "supporting_evidence": ["array of specific evidence points supporting outreach"],
  "weak_points": ["array of reasons this prospect might not convert"],
  "recommended_angle": "specific approach to use in the first message",
  "score_explanation": "2-3 sentence rationale for the overall score"
}

Scoring dimensions:
- relevance_score: how relevant is the seller's service to this prospect's work
- signal_score: strength of buying signals (pain points, recent changes, growth)
- fit_score: how well does the prospect match the ideal customer profile
- timing_score: how well-timed is outreach right now (recent events, role changes, etc.)
- overall_score: weighted average emphasizing signal (30%) + fit (30%) + relevance (25%) + timing (15%)`;

export interface OpportunityScoringInput {
  research: ResearchPipelineResult;
  business_brain: BusinessBrainContext;
  prospect_name: string;
  prospect_title?: string;
}

export function buildOpportunityScoringPrompt(
  input: OpportunityScoringInput,
): { system: string; user: string } {
  const user = `Prospect: ${input.prospect_name}${input.prospect_title ? `, ${input.prospect_title}` : ''}

## Research Summary
Professional: ${input.research.professional_summary}
Company: ${input.research.company_summary}
Recent developments: ${input.research.recent_developments.join('; ')}
Potential signals: ${input.research.potential_signals.join('; ')}
Research confidence: ${input.research.confidence}
Gaps: ${input.research.gaps.join('; ')}

## Seller's Business
Services: ${input.business_brain.services.join(', ')}
ICP Industries: ${input.business_brain.icp_industries.join(', ')}
ICP Job Titles: ${input.business_brain.icp_job_titles.join(', ')}
Pain Points Addressed: ${input.business_brain.pain_points.join(', ')}
Differentiators: ${input.business_brain.differentiators.join(', ')}

Score this opportunity.`;

  return { system: SYSTEM, user };
}
