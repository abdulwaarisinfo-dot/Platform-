import type { ProviderCostEntry, ResearchCostSummary } from '@platform/types';

export const COST_BENCHMARKS = {
  url_with_pdl_match: 0.15,
  url_without_pdl_match: 0.05,
  manual_no_pdl: 0.03,
} as const;

export class CostTracker {
  private entries: ProviderCostEntry[] = [];

  record(entry: ProviderCostEntry): void {
    this.entries.push(entry);
  }

  summarize(): ResearchCostSummary {
    let pdl = 0;
    let serper = 0;
    let ai = 0;
    let serperQueries = 0;
    let aiTokens = 0;
    let enrichmentMatched: boolean | null = null;

    for (const e of this.entries) {
      if (e.provider === 'pdl') {
        pdl += e.cost_usd;
        if (e.cost_usd > 0) enrichmentMatched = true;
        else if (enrichmentMatched === null) enrichmentMatched = false;
      } else if (e.provider === 'serper') {
        serper += e.cost_usd;
        serperQueries++;
      } else if (e.provider === 'anthropic') {
        ai += e.cost_usd;
        aiTokens += e.tokens_used ?? 0;
      }
    }

    return {
      pdl_cost_usd: pdl,
      serper_cost_usd: serper,
      ai_cost_usd: ai,
      total_cost_usd: pdl + serper + ai,
      enrichment_matched: enrichmentMatched,
      serper_queries_used: serperQueries,
      ai_tokens_used: aiTokens,
    };
  }

  totalUsd(): number {
    return this.entries.reduce((sum, e) => sum + e.cost_usd, 0);
  }
}

export function summarizeCost(entries: ProviderCostEntry[]): ResearchCostSummary {
  const tracker = new CostTracker();
  entries.forEach(e => tracker.record(e));
  return tracker.summarize();
}
