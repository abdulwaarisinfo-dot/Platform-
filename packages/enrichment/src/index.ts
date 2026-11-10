export { createPDLClient } from './pdl';
export type { PDLClient } from './pdl';
export { createSerperClient } from './serper';
export type { SerperClient } from './serper';
import { createPDLClient } from './pdl';
import { createSerperClient } from './serper';
import type { PdlEnrichmentResult } from '@platform/types';
import type { SerperSearchResult } from '@platform/types';

// ── Singleton env-based helpers used by research package ─────────────────────

function getPdlApiKey() {
  const key = process.env.PDL_API_KEY;
  if (!key) throw new Error('PDL_API_KEY is not set');
  return key;
}

function getSerperApiKey() {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new Error('SERPER_API_KEY is not set');
  return key;
}

export async function enrichFromLinkedIn(url: string): Promise<PdlEnrichmentResult> {
  return createPDLClient(getPdlApiKey()).enrichByLinkedIn(url);
}

export async function searchWeb(query: string): Promise<{ results: SerperSearchResult[]; cost_usd: number }> {
  const results = await createSerperClient(getSerperApiKey()).search(query);
  return { results, cost_usd: 0.001 };
}

export function buildProspectQueries(
  fullName: string,
  companyName?: string,
  jobTitle?: string,
  maxQueries = 2,
): string[] {
  const queries: string[] = [];
  const q1 = [fullName, companyName, 'professional'].filter(Boolean).join(' ');
  queries.push(q1);
  if (maxQueries >= 2) {
    const q2Parts = [fullName, jobTitle ?? (companyName ? `${companyName} news` : undefined)].filter(Boolean);
    const q2 = q2Parts.join(' ');
    if (q2 !== q1) queries.push(q2);
  }
  if (maxQueries >= 3 && companyName) {
    queries.push(`"${companyName}" funding OR hiring OR launch 2024 OR 2025`);
  }
  return queries.slice(0, maxQueries);
}

