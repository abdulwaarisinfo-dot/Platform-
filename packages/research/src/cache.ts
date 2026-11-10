import type { Collection } from 'mongodb';
import type { ResearchPipelineResult } from '@platform/types';

export interface ResearchCache {
  get(linkedin_url: string): Promise<ResearchPipelineResult | null>;
  set(linkedin_url: string, record_id: string, ttl_hours?: number): Promise<void>;
}

export function createResearchCache(
  collection: Collection,
): ResearchCache {
  return {
    async get(linkedin_url) {
      const now = new Date().toISOString();
      const data = await collection.findOne({
        linkedin_url,
        status: 'completed',
        expires_at: { $ne: null, $gt: now },
      }, {
        sort: { created_at: -1 },
      });

      if (!data) return null;

      return {
        success: true,
        strategy_used: 'cached',
        enrichment_confidence: (data.enrichment_confidence as ResearchPipelineResult['enrichment_confidence']) ?? 'limited',
        enrichment_matched: data.enrichment_matched ?? false,
        professional_summary: data.professional_summary ?? '',
        company_summary: data.company_summary ?? '',
        recent_developments: Array.isArray(data.recent_developments)
          ? (data.recent_developments as string[])
          : [],
        potential_signals: Array.isArray(data.potential_signals)
          ? (data.potential_signals as string[])
          : [],
        confidence: (data.confidence as 'high' | 'medium' | 'low') ?? 'low',
        gaps: Array.isArray(data.gaps) ? (data.gaps as string[]) : [],
        sources: Array.isArray(data.sources)
          ? (data.sources as ResearchPipelineResult['sources'])
          : [],
        cost_usd: 0,
        tokens_used: 0,
        cached: true,
      };
    },

    async set(linkedin_url, record_id, ttl_hours = 168) {
      const expires_at = new Date(Date.now() + ttl_hours * 60 * 60 * 1000).toISOString();
      const { ObjectId } = await import('mongodb');
      let filter: object;
      try {
        filter = { _id: new ObjectId(record_id), linkedin_url };
      } catch {
        filter = { _id: record_id, linkedin_url };
      }
      await collection.updateOne(filter, { $set: { expires_at } });
    },
  };
}
