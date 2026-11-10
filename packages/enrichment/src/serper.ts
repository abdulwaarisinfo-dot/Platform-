import type { SerperSearchResult } from '@platform/types';

const SERPER_URL = 'https://google.serper.dev/search';
const TIMEOUT_MS = 8_000;

export interface SerperClient {
  search(query: string): Promise<SerperSearchResult[]>;
  searchPerson(name: string, company?: string): Promise<SerperSearchResult[]>;
  searchCompany(company: string): Promise<SerperSearchResult[]>;
  searchRecent(name: string, company?: string): Promise<SerperSearchResult[]>;
}

export function createSerperClient(apiKey: string): SerperClient {
  async function rawSearch(query: string): Promise<SerperSearchResult[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(SERPER_URL, {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num: 10 }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new Error(`Serper error ${response.status}: ${await response.text()}`);
    }

    const body = await response.json() as Record<string, unknown>;
    const organic = Array.isArray(body['organic']) ? body['organic'] : [];

    const seen = new Set<string>();
    const results: SerperSearchResult[] = [];

    for (const item of organic as Record<string, unknown>[]) {
      const url = String(item['link'] ?? '');
      if (!url || seen.has(url)) continue;
      seen.add(url);
      results.push({
        title: String(item['title'] ?? ''),
        url,
        snippet: String(item['snippet'] ?? ''),
        date: item['date'] ? String(item['date']) : undefined,
      });
    }

    return results.slice(0, 10);
  }

  return {
    search: rawSearch,

    searchPerson(name, company) {
      const q = company
        ? `"${name}" "${company}" professional`
        : `"${name}" professional profile`;
      return rawSearch(q);
    },

    searchCompany(company) {
      return rawSearch(`"${company}" company news funding team 2024 2025`);
    },

    searchRecent(name, company) {
      const q = company
        ? `"${name}" "${company}" 2024 2025 news`
        : `"${name}" 2024 2025 news announcement`;
      return rawSearch(q);
    },
  };
}
