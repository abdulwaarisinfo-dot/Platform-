import { describe, it, expect } from 'vitest';
import { safeParseJson } from '../client';

describe('safeParseJson', () => {
  it('parses valid JSON objects', () => {
    const result = safeParseJson<{ foo: string }>('{"foo":"bar"}');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('extracts JSON from surrounding text (AI response wrapping)', () => {
    const text = 'Here is the result:\n{"score":42,"label":"good"}\nDone.';
    const result = safeParseJson<{ score: number; label: string }>(text);
    expect(result).toEqual({ score: 42, label: 'good' });
  });

  it('extracts outermost JSON span (first { to last })', () => {
    // safeParseJson slices from first { to last }, so nested objects work
    const text = 'Result: {"a":1,"nested":{"b":2}}';
    const result = safeParseJson<{ a: number; nested: { b: number } }>(text);
    expect(result).toEqual({ a: 1, nested: { b: 2 } });
  });

  it('returns null for text with no JSON object', () => {
    expect(safeParseJson('no json here')).toBeNull();
    expect(safeParseJson('')).toBeNull();
    expect(safeParseJson('[1,2,3]')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(safeParseJson('{broken json}')).toBeNull();
    expect(safeParseJson('{"key": }')).toBeNull();
  });

  it('handles nested objects', () => {
    const result = safeParseJson<{ nested: { val: number } }>(
      '{"nested":{"val":99}}',
    );
    expect(result).toEqual({ nested: { val: 99 } });
  });
});
