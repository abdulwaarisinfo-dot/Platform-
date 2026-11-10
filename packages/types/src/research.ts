import type { PdlEnrichmentResult } from './enrichment';

export type { PdlEnrichmentResult };

export type InputMode = 'linkedin_url' | 'manual' | 'bulk';
export type EnrichmentConfidence = 'enriched' | 'web_only' | 'limited';
export type EvidenceQuality =
  | 'verified'
  | 'strongly_supported'
  | 'weakly_supported'
  | 'unavailable'
  | 'hypothesis';
export type ResearchStrategy =
  | 'enrichment_first'
  | 'web_first'
  | 'web_only'
  | 'cached';

// PdlEnrichmentResult is defined in enrichment.ts — re-exported from there via index.ts

export interface SerperSearchResult {
  title: string;
  url: string;
  snippet: string;
  date?: string;
}

export interface BusinessBrainContext {
  services: string[];
  icp_industries: string[];
  icp_company_sizes: string[];
  icp_job_titles: string[];
  pain_points: string[];
  differentiators: string[];
  communication_tone: string;
}

export interface ResearchContext {
  prospect_id: string;
  user_id: string;
  input_mode: InputMode;
  linkedin_url?: string;
  full_name: string;
  company_name?: string;
  job_title?: string;
  user_bio?: string;
  business_brain?: BusinessBrainContext;
}

export interface ResearchSynthesisInput {
  prospect_name: string;
  prospect_company?: string;
  prospect_title?: string;
  enrichment_data?: PdlEnrichmentResult;
  search_results: SerperSearchResult[];
  business_brain: BusinessBrainContext;
  input_mode: InputMode;
}

export interface ResearchPipelineResult {
  success: boolean;
  strategy_used: ResearchStrategy;
  enrichment_confidence: EnrichmentConfidence;
  enrichment_matched?: boolean;
  professional_summary: string;
  company_summary: string;
  recent_developments: string[];
  potential_signals: string[];
  confidence: 'high' | 'medium' | 'low';
  gaps: string[];
  sources: Array<{
    url: string;
    title: string;
    snippet: string;
    type: string;
  }>;
  cost_usd: number;
  tokens_used: number;
  cached: boolean;
}

export interface CostBudget {
  max_total_usd: number;
  max_pdl_usd: number;
  max_serper_queries: number;
  max_ai_tokens: number;
}

// Cost tracking per provider call
export interface ProviderCostEntry {
  provider: 'pdl' | 'serper' | 'anthropic';
  operation: string;
  cost_usd: number;
  tokens_used?: number;
}

export interface ResearchCostSummary {
  pdl_cost_usd: number;
  serper_cost_usd: number;
  ai_cost_usd: number;
  total_cost_usd: number;
  enrichment_matched: boolean | null;
  serper_queries_used: number;
  ai_tokens_used: number;
}

export interface SynthesisResult {
  professional_summary: string;
  company_summary: string;
  recent_developments: Array<{ description: string }>;
  potential_signals: string[];
  confidence: 'high' | 'medium' | 'low';
  gaps: string[];
  cost_usd: number;
  tokens_used: number;
}

export interface BrainValidationResult {
  completeness_score: number;
  critical_gaps: string[];
  suggestions: string[];
  ready_for_research: boolean;
  cost_usd: number;
  tokens_used: number;
}

export interface OpportunityScore {
  overall_score: number;
  relevance_score: number;
  signal_score: number;
  fit_score: number;
  timing_score: number;
  primary_opportunity: string;
  supporting_evidence: Array<{
    point: string;
    source: string | null;
    confidence: 'confirmed' | 'inferred';
  }>;
  weak_points: string[];
  recommended_angle: string;
  score_explanation: string;
  cost_usd: number;
  tokens_used: number;
}

export interface OutreachMessage {
  subject: string | null;
  body: string;
  message_type: string;
  character_count: number;
  cost_usd: number;
  tokens_used: number;
}

// ─── Model routing ────────────────────────────────────────────────────────────

export type ModelTier = 'cheap' | 'standard' | 'powerful';

export interface ModelConfig {
  model_id: string;
  input_cost_per_1m: number;
  output_cost_per_1m: number;
  tier: ModelTier;
  max_tokens: number;
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'claude-haiku-5-5': {
    model_id: 'claude-haiku-5-5',
    input_cost_per_1m: 0.10,
    output_cost_per_1m: 0.50,
    tier: 'cheap',
    max_tokens: 8192,
  },
  'claude-sonnet-5-5': {
    model_id: 'claude-sonnet-5-5',
    input_cost_per_1m: 2.00,
    output_cost_per_1m: 10.00,
    tier: 'standard',
    max_tokens: 16000,
  },
};

// Task → model routing rules (cost optimization)
export const TASK_MODEL_MAP: Record<string, string> = {
  brain_extraction: 'claude-haiku-5-5',       // Simple structured extraction
  brain_validation: 'claude-haiku-5-5',        // Simple scoring
  research_synthesis: 'claude-sonnet-5-5',     // Needs depth and nuance
  opportunity_scoring: 'claude-sonnet-5-5',    // Needs Business Brain reasoning
  message_generation: 'claude-sonnet-5-5',     // Quality matters for outreach
  message_rewrite: 'claude-haiku-5-5',         // Minor edits, cheaper model fine
  identity_resolution: 'claude-haiku-5-5',     // Pattern matching, no nuance needed
};

export function calculateTokenCost(
  model_id: string,
  input_tokens: number,
  output_tokens: number
): number {
  const config = MODEL_CONFIGS[model_id];
  if (!config) return 0;
  return (
    (input_tokens / 1_000_000) * config.input_cost_per_1m +
    (output_tokens / 1_000_000) * config.output_cost_per_1m
  );
}
