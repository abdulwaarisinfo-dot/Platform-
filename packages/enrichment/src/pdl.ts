import type { PdlEnrichmentResult } from '@platform/types';

const PDL_COST_PER_MATCH = 0.28;
const PDL_BASE_URL = 'https://api.peopledatalabs.com/v5/person/enrich';
const TIMEOUT_MS = 10_000;

function mapCompanySize(count: number | null | undefined): string {
  if (!count) return 'Unknown';
  if (count < 11) return '1-10';
  if (count < 51) return '11-50';
  if (count < 201) return '51-200';
  if (count < 501) return '201-500';
  if (count < 1001) return '501-1000';
  if (count < 5001) return '1001-5000';
  return '5000+';
}

export interface PDLClient {
  enrichByLinkedIn(url: string): Promise<PdlEnrichmentResult>;
}

export function createPDLClient(apiKey: string): PDLClient {
  return {
    async enrichByLinkedIn(url) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(PDL_BASE_URL, {
          method: 'POST',
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ profile: [url], pretty: false }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (response.status === 404) {
        return { matched: false, cost_usd: 0 };
      }

      if (response.status === 402) {
        throw new Error('PDL quota exceeded');
      }

      if (!response.ok) {
        throw new Error(`PDL error ${response.status}: ${await response.text()}`);
      }

      const body = await response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown> | null;

      if (!data) {
        return { matched: false, cost_usd: 0 };
      }

      const experience = Array.isArray(data['experience'])
        ? (data['experience'] as Record<string, unknown>[]).map((e) => ({
            company: String(e['company_name'] ?? ''),
            title: String(e['title'] ?? e['job_title'] ?? ''),
            start_date: String(e['start_date'] ?? ''),
            end_date: e['end_date'] ? String(e['end_date']) : undefined,
          }))
        : undefined;

      const education = Array.isArray(data['education'])
        ? (data['education'] as Record<string, unknown>[]).map((e) => ({
            school: String(e['school'] ? (e['school'] as Record<string,unknown>)['name'] ?? e['school'] : ''),
            degree: String((e['degrees'] as unknown[])?.[0] ?? ''),
            field: String((e['majors'] as unknown[])?.[0] ?? ''),
          }))
        : undefined;

      const skills = Array.isArray(data['skills'])
        ? (data['skills'] as Record<string, unknown>[]).map((s) => String(s['display_name'] ?? s))
        : undefined;

      return {
        matched: true,
        full_name: data['full_name'] ? String(data['full_name']) : undefined,
        job_title: data['job_title'] ? String(data['job_title']) : undefined,
        company_name: data['job_company_name'] ? String(data['job_company_name']) : undefined,
        company_size: mapCompanySize(data['job_company_employee_count'] as number | null),
        industry: data['industry'] ? String(data['industry']) : undefined,
        location: data['location_name'] ? String(data['location_name']) : undefined,
        summary: data['summary'] ? String(data['summary']) : undefined,
        skills,
        education,
        experience,
        linkedin_url: data['linkedin_url'] ? String(data['linkedin_url']) : undefined,
        cost_usd: PDL_COST_PER_MATCH,
      };
    },
  };
}
