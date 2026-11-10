const LINKEDIN_IN_PATTERN = /^https?:\/\/(www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)\/?/;

export function normalizeLinkedInUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (!url.hostname.endsWith('linkedin.com')) return null;
    const match = LINKEDIN_IN_PATTERN.exec(raw);
    if (!match?.[2]) return null;
    return `https://www.linkedin.com/in/${match[2]}/`;
  } catch {
    return null;
  }
}

export function isLinkedInProfileUrl(url: string): boolean {
  return LINKEDIN_IN_PATTERN.test(url);
}

export function extractLinkedInSlug(url: string): string | null {
  const match = LINKEDIN_IN_PATTERN.exec(url);
  return match?.[2] ?? null;
}
