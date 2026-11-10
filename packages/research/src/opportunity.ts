import type { ResearchPipelineResult, BusinessBrainContext } from '@platform/types';
import { buildOpportunityScoringPrompt } from '@platform/ai';
import type { AIClient } from '@platform/ai';

export interface OpportunityScoreResult {
  overall_score: number;
  relevance_score: number;
  signal_score: number;
  fit_score: number;
  timing_score: number;
  primary_opportunity: string;
  supporting_evidence: string[];
  weak_points: string[];
  recommended_angle: string;
  score_explanation: string;
  cost_usd: number;
  tokens_used: number;
}

export interface OpportunityScorer {
  score(params: {
    research: ResearchPipelineResult;
    business_brain: BusinessBrainContext;
    prospect_name: string;
    prospect_title?: string;
  }): Promise<OpportunityScoreResult>;
}

function parseJson(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(cleaned) as Record<string, unknown>;
}

export function createOpportunityScorer(ai: AIClient): OpportunityScorer {
  return {
    async score(params) {
      const { system, user } = buildOpportunityScoringPrompt(params);

      const response = await ai.complete({
        task: 'opportunity_scoring',
        system,
        user,
        max_tokens: 1024,
      });

      let parsed: Record<string, unknown> = {};
      try {
        parsed = parseJson(response.content);
      } catch {
        // Return safe defaults on parse failure
      }

      const clamp = (n: unknown) =>
        Math.min(100, Math.max(0, typeof n === 'number' ? Math.round(n) : 0));

      return {
        overall_score: clamp(parsed['overall_score']),
        relevance_score: clamp(parsed['relevance_score']),
        signal_score: clamp(parsed['signal_score']),
        fit_score: clamp(parsed['fit_score']),
        timing_score: clamp(parsed['timing_score']),
        primary_opportunity: String(parsed['primary_opportunity'] ?? ''),
        supporting_evidence: Array.isArray(parsed['supporting_evidence'])
          ? (parsed['supporting_evidence'] as string[])
          : [],
        weak_points: Array.isArray(parsed['weak_points'])
          ? (parsed['weak_points'] as string[])
          : [],
        recommended_angle: String(parsed['recommended_angle'] ?? ''),
        score_explanation: String(parsed['score_explanation'] ?? ''),
        cost_usd: response.cost_usd,
        tokens_used: response.input_tokens + response.output_tokens,
      };
    },
  };
}
