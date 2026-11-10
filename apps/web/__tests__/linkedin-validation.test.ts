import { describe, it, expect } from 'vitest';

// Extracted from app/api/prospects/bulk/route.ts — the production regex
const LINKEDIN_RE = /^https?:\/\/(www\.)?linkedin\.com\/in\/[^/?#]+\/?/i;

describe('LINKEDIN_RE bulk upload validation', () => {
  describe('valid profile URLs', () => {
    const validUrls = [
      'https://www.linkedin.com/in/john-doe',
      'https://linkedin.com/in/john-doe',
      'http://www.linkedin.com/in/john-doe',
      'https://www.linkedin.com/in/john-doe/',
      'https://www.linkedin.com/in/john-doe123',
      'https://www.linkedin.com/in/john_doe',
      'HTTPS://WWW.LINKEDIN.COM/IN/JOHN-DOE', // case insensitive flag
    ];

    validUrls.forEach((url) => {
      it(`accepts: ${url}`, () => {
        expect(LINKEDIN_RE.test(url)).toBe(true);
      });
    });
  });

  describe('invalid URLs rejected', () => {
    const invalidUrls = [
      'https://www.linkedin.com/company/acme',
      'https://www.linkedin.com/pub/john-doe/1/2/3',
      'https://www.facebook.com/in/john-doe',
      'https://www.linkedin.com/',
      'https://www.linkedin.com/in/',
      'not-a-url',
      '',
      'linkedin.com/in/john-doe', // missing protocol
      'https://linkedin.co.uk/in/john-doe', // wrong TLD
    ];

    invalidUrls.forEach((url) => {
      it(`rejects: ${url || '(empty)'}`, () => {
        expect(LINKEDIN_RE.test(url)).toBe(false);
      });
    });
  });
});
