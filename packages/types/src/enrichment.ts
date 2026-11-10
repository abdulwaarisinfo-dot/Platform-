// Enrichment provider types

export interface PdlEnrichmentResult {
  matched: boolean;
  full_name?: string;
  job_title?: string;
  company_name?: string;
  company_size?: string;
  industry?: string;
  location?: string;
  summary?: string;
  skills?: string[];
  experience?: Array<{
    company: string;
    title: string;
    start_date?: string;
    end_date?: string;
  }>;
  education?: Array<{
    school: string;
    degree?: string;
    field?: string;
  }>;
  linkedin_url?: string;
  cost_usd: number;
}

export interface SerperResult {
  title: string;
  url: string;
  snippet: string;
  date?: string;
  source?: string;
}

export interface SerperSearchResponse {
  results: SerperResult[];
  cost_usd: number;
  query: string;
}
