import type { ResearchContext, ResearchPipelineResult } from '@platform/types';
import { createPDLClient, createSerperClient } from '@platform/enrichment';
import { createAIClient } from '@platform/ai';
import { createResearchPipeline } from './pipeline';
import { createResearchCache } from './cache';
import { MongoClient } from 'mongodb';

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`${key} environment variable is not set`);
  return val;
}

let _client: MongoClient | null = null;

async function getResearchCollection() {
  if (!_client) {
    _client = new MongoClient(getEnv('MONGODB_URI'));
    await _client.connect();
  }
  return _client.db(process.env.MONGODB_DB_NAME ?? 'platform').collection('research_records');
}

/**
 * Convenience wrapper: wires up all deps from env vars and runs the pipeline.
 * Use this from API routes; use createResearchPipeline directly in tests.
 */
export async function executeResearchPipeline(
  context: ResearchContext,
): Promise<ResearchPipelineResult> {
  const researchRecords = await getResearchCollection();

  const pipeline = createResearchPipeline({
    ai: createAIClient(getEnv('ANTHROPIC_API_KEY')),
    pdl: createPDLClient(getEnv('PDL_API_KEY')),
    serper: createSerperClient(getEnv('SERPER_API_KEY')),
    cache: createResearchCache(researchRecords),
  });

  return pipeline.run(context);
}
