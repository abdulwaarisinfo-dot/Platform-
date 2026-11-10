import { describe, it, expect } from 'vitest';
import {
  normalizeLinkedInUrl,
  isLinkedInProfileUrl,
  extractLinkedInSlug,
} from '../normalize';

describe('normalizeLinkedInUrl', () => {
  it('normalizes a standard profile URL', () => {
    expect(normalizeLinkedInUrl('https://www.linkedin.com/in/john-doe')).toBe(
      'https://www.linkedin.com/in/john-doe/',
    );
  });

  it('normalizes without www', () => {
    expect(normalizeLinkedInUrl('https://linkedin.com/in/jane-smith')).toBe(
      'https://www.linkedin.com/in/jane-smith/',
    );
  });

  it('normalizes http to canonical https form', () => {
    expect(normalizeLinkedInUrl('http://www.linkedin.com/in/someone')).toBe(
      'https://www.linkedin.com/in/someone/',
    );
  });

  it('strips trailing slash before rebuilding', () => {
    expect(normalizeLinkedInUrl('https://www.linkedin.com/in/john-doe/')).toBe(
      'https://www.linkedin.com/in/john-doe/',
    );
  });

  it('strips query params', () => {
    expect(
      normalizeLinkedInUrl('https://www.linkedin.com/in/john-doe/?trk=abc'),
    ).toBe('https://www.linkedin.com/in/john-doe/');
  });

  it('returns null for a company URL', () => {
    expect(normalizeLinkedInUrl('https://www.linkedin.com/company/acme')).toBeNull();
  });

  it('returns null for a non-linkedin URL', () => {
    expect(normalizeLinkedInUrl('https://example.com/in/john-doe')).toBeNull();
  });

  it('returns null for an invalid URL string', () => {
    expect(normalizeLinkedInUrl('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(normalizeLinkedInUrl('')).toBeNull();
  });
});

describe('isLinkedInProfileUrl', () => {
  it('returns true for valid profile URLs', () => {
    expect(isLinkedInProfileUrl('https://www.linkedin.com/in/john-doe')).toBe(true);
    expect(isLinkedInProfileUrl('https://linkedin.com/in/jane')).toBe(true);
  });

  it('returns false for non-profile URLs', () => {
    expect(isLinkedInProfileUrl('https://www.linkedin.com/company/acme')).toBe(false);
    expect(isLinkedInProfileUrl('https://google.com')).toBe(false);
    expect(isLinkedInProfileUrl('')).toBe(false);
  });
});

describe('extractLinkedInSlug', () => {
  it('extracts the slug from a full URL', () => {
    expect(extractLinkedInSlug('https://www.linkedin.com/in/john-doe-123')).toBe('john-doe-123');
  });

  it('handles underscores and numbers', () => {
    expect(extractLinkedInSlug('https://linkedin.com/in/jane_smith99')).toBe('jane_smith99');
  });

  it('returns null for non-profile URLs', () => {
    expect(extractLinkedInSlug('https://www.linkedin.com/company/acme')).toBeNull();
    expect(extractLinkedInSlug('not-a-url')).toBeNull();
  });
});
