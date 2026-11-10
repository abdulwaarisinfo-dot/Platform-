import { describe, it, expect, beforeEach } from 'vitest';
import { CostTracker, summarizeCost } from '../cost-tracker';

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  it('starts with zero totals', () => {
    const summary = tracker.summarize();
    expect(summary.total_cost_usd).toBe(0);
    expect(summary.pdl_cost_usd).toBe(0);
    expect(summary.serper_cost_usd).toBe(0);
    expect(summary.ai_cost_usd).toBe(0);
    expect(summary.enrichment_matched).toBeNull();
  });

  it('records a PDL matched entry', () => {
    tracker.record({ provider: 'pdl', operation: 'enrich', cost_usd: 0.1 });
    const summary = tracker.summarize();
    expect(summary.pdl_cost_usd).toBe(0.1);
    expect(summary.enrichment_matched).toBe(true);
  });

  it('records a PDL unmatched entry (cost=0)', () => {
    tracker.record({ provider: 'pdl', operation: 'enrich', cost_usd: 0 });
    const summary = tracker.summarize();
    expect(summary.pdl_cost_usd).toBe(0);
    expect(summary.enrichment_matched).toBe(false);
  });

  it('matched PDL takes precedence over later zero-cost PDL', () => {
    tracker.record({ provider: 'pdl', operation: 'enrich', cost_usd: 0.1 });
    tracker.record({ provider: 'pdl', operation: 'enrich', cost_usd: 0 });
    const summary = tracker.summarize();
    expect(summary.enrichment_matched).toBe(true);
  });

  it('accumulates serper queries and cost', () => {
    tracker.record({ provider: 'serper', operation: 'search', cost_usd: 0.01 });
    tracker.record({ provider: 'serper', operation: 'search', cost_usd: 0.01 });
    const summary = tracker.summarize();
    expect(summary.serper_cost_usd).toBeCloseTo(0.02);
    expect(summary.serper_queries_used).toBe(2);
  });

  it('accumulates AI cost and tokens', () => {
    tracker.record({ provider: 'anthropic', operation: 'synthesize', cost_usd: 0.005, tokens_used: 500 });
    tracker.record({ provider: 'anthropic', operation: 'synthesize', cost_usd: 0.003, tokens_used: 300 });
    const summary = tracker.summarize();
    expect(summary.ai_cost_usd).toBeCloseTo(0.008);
    expect(summary.ai_tokens_used).toBe(800);
  });

  it('calculates total_cost_usd across all providers', () => {
    tracker.record({ provider: 'pdl', operation: 'enrich', cost_usd: 0.1 });
    tracker.record({ provider: 'serper', operation: 'search', cost_usd: 0.01 });
    tracker.record({ provider: 'anthropic', operation: 'synthesize', cost_usd: 0.005, tokens_used: 100 });
    const summary = tracker.summarize();
    expect(summary.total_cost_usd).toBeCloseTo(0.115);
  });

  it('totalUsd matches total_cost_usd', () => {
    tracker.record({ provider: 'pdl', operation: 'enrich', cost_usd: 0.1 });
    tracker.record({ provider: 'anthropic', operation: 'synthesize', cost_usd: 0.02, tokens_used: 200 });
    expect(tracker.totalUsd()).toBeCloseTo(tracker.summarize().total_cost_usd);
  });
});

describe('summarizeCost', () => {
  it('summarizes a list of entries', () => {
    const entries = [
      { provider: 'pdl' as const, operation: 'enrich', cost_usd: 0.15 },
      { provider: 'serper' as const, operation: 'search', cost_usd: 0.01 },
      { provider: 'anthropic' as const, operation: 'synthesize', cost_usd: 0.004, tokens_used: 400 },
    ];
    const summary = summarizeCost(entries);
    expect(summary.total_cost_usd).toBeCloseTo(0.164);
    expect(summary.enrichment_matched).toBe(true);
    expect(summary.serper_queries_used).toBe(1);
  });

  it('returns zero summary for empty input', () => {
    const summary = summarizeCost([]);
    expect(summary.total_cost_usd).toBe(0);
    expect(summary.enrichment_matched).toBeNull();
  });
});
