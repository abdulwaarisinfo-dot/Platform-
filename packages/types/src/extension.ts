import type { ResearchPipelineResult } from './research';

export interface ExtensionAuthState {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user_id: string;
}

export type ExtensionView =
  | 'auth'
  | 'idle'
  | 'profile'
  | 'research'
  | 'outreach'
  | 'manual';

export interface ExtensionState {
  auth: ExtensionAuthState | null;
  current_view: ExtensionView;
  detected_linkedin_url: string | null;
  current_research: ResearchPipelineResult | null;
  current_prospect_id: string | null;
  usage: { used: number; limit: number } | null;
}

export const LINKEDIN_PROFILE_PATTERN =
  /^https?:\/\/(www\.)?linkedin\.com\/in\/([^/?#]+)\/?/;

export function isLinkedInProfileUrl(url: string): boolean {
  return LINKEDIN_PROFILE_PATTERN.test(url);
}

export function extractLinkedInSlug(url: string): string | null {
  const match = LINKEDIN_PROFILE_PATTERN.exec(url);
  return match?.[2] ?? null;
}

export function normalizeLinkedInUrl(url: string): string | null {
  const slug = extractLinkedInSlug(url);
  if (!slug) return null;
  return `https://www.linkedin.com/in/${slug}`;
}
