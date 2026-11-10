import { describe, it, expect } from 'vitest';
import { buildBrainExtractionPrompt } from '../prompts/brain-extraction';

describe('buildBrainExtractionPrompt', () => {
  it('returns system and user strings', () => {
    const result = buildBrainExtractionPrompt({ raw_text: 'We sell SaaS to HR teams.' });
    expect(typeof result.system).toBe('string');
    expect(typeof result.user).toBe('string');
    expect(result.system.length).toBeGreaterThan(0);
  });

  it('includes raw_text in user prompt', () => {
    const raw_text = 'We help fintech startups grow ARR.';
    const { user } = buildBrainExtractionPrompt({ raw_text });
    expect(user).toContain(raw_text);
  });

  it('includes existing_facts when provided', () => {
    const { user } = buildBrainExtractionPrompt({
      raw_text: 'Some new info.',
      existing_facts: [{ category: 'service', key: 'main_product', value: 'CRM' }],
    });
    expect(user).toContain('main_product');
    expect(user).toContain('CRM');
  });

  it('omits existing_facts section when not provided', () => {
    const { user } = buildBrainExtractionPrompt({ raw_text: 'Info.' });
    expect(user).not.toContain('Existing facts');
  });

  it('omits existing_facts section when empty array', () => {
    const { user } = buildBrainExtractionPrompt({
      raw_text: 'Info.',
      existing_facts: [],
    });
    expect(user).not.toContain('Existing facts');
  });

  it('system prompt instructs JSON-only output', () => {
    const { system } = buildBrainExtractionPrompt({ raw_text: 'x' });
    expect(system).toContain('JSON');
    expect(system).toContain('facts');
  });
});
