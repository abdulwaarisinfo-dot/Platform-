import type {
  ResearchContext,
  ResearchPipelineResult,
  ResearchSynthesisInput,
  SerperSearchResult,
  PdlEnrichmentResult,
} from '@platform/types';
import { buildResearchSynthesisPrompt } from '@platform/ai';
import type { AIClient } from '@platform/ai';
import type { PDLClient } from '@platform/enrichment';
import type { SerperClient } from '@platform/enrichment';
import type { ResearchCache } from './cache';

export interface ResearchPipeline {
  run(context: ResearchContext): Promise<ResearchPipelineResult>;
}

interface PipelineDeps {
  ai: AIClient;
  pdl: PDLClient;
  serper: SerperClient;
  cache: ResearchCache;
}

function deduplicateResults(results: SerperSearchResult[]): SerperSearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

function parseSynthesisJson(raw: string): Partial<{
  professional_summary: string;
  company_summary: string;
  recent_developments: string[];
  potential_signals: string[];
  confidence: 'high' | 'medium' | 'low';
  gaps: string[];
}> {
  // Strip possible markdown code fences
  const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(cleaned);
}

export function createResearchPipeline(deps: PipelineDeps): ResearchPipeline {
  const { ai, pdl, serper, cache } = deps;

  return {
    async run(context) {
      const totalCostEntries: Array<{ provider: string; cost_usd: number; tokens?: number }> = [];

      // ── Step 1: Cache check ──────────────────────────────────────────────────
      if (context.input_mode === 'linkedin_url' && context.linkedin_url) {
        const cached = await cache.get(context.linkedin_url).catch(() => null);
        if (cached) return cached;
      }

      // ── Step 2: PDL enrichment ───────────────────────────────────────────────
      let enrichmentData: PdlEnrichmentResult | undefined;
      let enrichmentMatched = false;
      let enrichmentConfidence: ResearchPipelineResult['enrichment_confidence'] = 'web_only';
      let strategyUsed: ResearchPipelineResult['strategy_used'] = 'web_only';

      if (context.input_mode === 'linkedin_url' && context.linkedin_url) {
        try {
          const data = await pdl.enrichByLinkedIn(context.linkedin_url);
          enrichmentData = data;
          if (data.matched) {
            enrichmentMatched = true;
            enrichmentConfidence = 'enriched';
            strategyUsed = 'enrichment_first';
            totalCostEntries.push({ provider: 'pdl', cost_usd: data.cost_usd });
          } else {
            strategyUsed = 'web_first';
          }
        } catch {
          // PDL failure is non-fatal; continue with web search
          strategyUsed = 'web_first';
        }
      } else {
        strategyUsed = 'web_only';
      }

      // ── Step 3: Web search ───────────────────────────────────────────────────
      const allResults: SerperSearchResult[] = [];

      try {
        const personResults = await serper.searchPerson(
          context.full_name,
          context.company_name,
        );
        allResults.push(...personResults);
        totalCostEntries.push({ provider: 'serper', cost_usd: 0.001 });
      } catch {
        // non-fatal
      }

      // Company search if we have a company name
      if (context.company_name) {
        try {
          const companyResults = await serper.searchCompany(context.company_name);
          allResults.push(...companyResults);
          totalCostEntries.push({ provider: 'serper', cost_usd: 0.001 });
        } catch {
          // non-fatal
        }
      }

      // Recent news search — skip if enrichment matched AND we already have rich data
      // (cost optimization: don't pay for 4 queries when PDL gave us everything)
      const shouldFetchRecent = !enrichmentMatched || allResults.length < 5;
      if (shouldFetchRecent) {
        try {
          const recentResults = await serper.searchRecent(
            context.full_name,
            context.company_name,
          );
          allResults.push(...recentResults);
          totalCostEntries.push({ provider: 'serper', cost_usd: 0.001 });
        } catch {
          // non-fatal
        }
      }

      const searchResults = deduplicateResults(allResults).slice(0, 15);

      // ── Step 4: AI synthesis ─────────────────────────────────────────────────
      if (!context.business_brain) {
        // No business brain — return raw research without scoring
        enrichmentConfidence = enrichmentMatched ? 'enriched' : allResults.length > 0 ? 'web_only' : 'limited';
      }

      const synthesisInput: ResearchSynthesisInput = {
        prospect_name: context.full_name,
        prospect_company: context.company_name,
        prospect_title: context.job_title,
        enrichment_data: enrichmentData,
        search_results: searchResults,
        business_brain: context.business_brain ?? {
          services: [],
          icp_industries: [],
          icp_company_sizes: [],
          icp_job_titles: [],
          pain_points: [],
          differentiators: [],
          communication_tone: 'professional',
        },
        input_mode: context.input_mode,
      };

      const { system, user } = buildResearchSynthesisPrompt(synthesisInput);

      let synthesisResult: ReturnType<typeof parseSynthesisJson> = {};
      let aiTokensUsed = 0;
      let aiCost = 0;

      try {
        const aiResponse = await ai.complete({
          task: 'research_synthesis',
          system,
          user,
          max_tokens: 2048,
        });
        synthesisResult = parseSynthesisJson(aiResponse.content);
        aiTokensUsed = aiResponse.input_tokens + aiResponse.output_tokens;
        aiCost = aiResponse.cost_usd;
        totalCostEntries.push({ provider: 'anthropic', cost_usd: aiCost, tokens: aiTokensUsed });
      } catch (parseErr) {
        // Retry once with explicit JSON instruction
        try {
          const retryResponse = await ai.complete({
            task: 'research_synthesis',
            system: system + '\n\nCRITICAL: Output ONLY valid JSON. No other text.',
            user,
            max_tokens: 2048,
          });
          synthesisResult = parseSynthesisJson(retryResponse.content);
          aiTokensUsed = retryResponse.input_tokens + retryResponse.output_tokens;
          aiCost = retryResponse.cost_usd;
          totalCostEntries.push({ provider: 'anthropic', cost_usd: aiCost, tokens: aiTokensUsed });
        } catch {
          // Fall through with empty synthesis
        }
      }

      // ── Step 5: Assemble result ──────────────────────────────────────────────
      const totalCost = totalCostEntries.reduce((sum, e) => sum + e.cost_usd, 0);

      const sources = searchResults.map((r) => ({
        url: r.url,
        title: r.title,
        snippet: r.snippet,
        type: 'web_search',
      }));

      if (!context.business_brain) {
        enrichmentConfidence = 'limited';
      }

      return {
        success: true,
        strategy_used: strategyUsed,
        enrichment_confidence: enrichmentConfidence,
        enrichment_matched: enrichmentMatched,
        professional_summary: synthesisResult.professional_summary ?? '',
        company_summary: synthesisResult.company_summary ?? '',
        recent_developments: synthesisResult.recent_developments ?? [],
        potential_signals: synthesisResult.potential_signals ?? [],
        confidence: synthesisResult.confidence ?? 'low',
        gaps: synthesisResult.gaps ?? [],
        sources,
        cost_usd: Math.round(totalCost * 1_000_000) / 1_000_000,
        tokens_used: aiTokensUsed,
        cached: false,
      };
    },
  };
}
