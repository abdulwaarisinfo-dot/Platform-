'use client';

import { useEffect, useState, useRef } from 'react';

type FactConfidence = 'confirmed' | 'inferred';

interface BrainFact {
  id: string;
  category: string;
  key: string;
  value: string;
  confidence: FactConfidence;
}

interface Brain {
  id: string;
  name: string | null;
  description: string | null;
  completeness_score: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  service: 'What you offer',
  icp_industry: 'Target industry',
  icp_title: 'Target title',
  icp_size: 'Company size',
  pain_point: 'Pain points',
  differentiator: 'Differentiators',
  tone: 'Tone & voice',
};

export default function BrainPage() {
  const [brain, setBrain] = useState<Brain | null>(null);
  const [facts, setFacts] = useState<BrainFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [extractResult, setExtractResult] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/brain');
    if (res.ok) {
      const data = await res.json() as { brain: Brain | null; facts: BrainFact[] };
      setBrain(data.brain);
      setFacts(data.facts ?? []);
    }
    setLoading(false);
  }

  async function extract() {
    if (!text.trim()) return;
    setExtracting(true);
    setExtractResult(null);
    const res = await fetch('/api/brain/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const data = await res.json() as { brain: Brain; facts: BrainFact[]; extracted_count: number };
      setBrain(data.brain);
      setFacts(data.facts ?? []);
      setExtractResult(`Extracted ${data.extracted_count} new fact${data.extracted_count === 1 ? '' : 's'}.`);
      setText('');
    } else {
      const err = await res.json() as { error?: { message?: string } };
      setExtractResult(`Error: ${err.error?.message ?? 'Extraction failed'}`);
    }
    setExtracting(false);
  }

  async function saveFact(id: string) {
    if (!editValue.trim()) return;
    const res = await fetch(`/api/brain/facts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: editValue, confidence: 'confirmed' }),
    });
    if (res.ok) {
      const data = await res.json() as { fact: BrainFact };
      setFacts(prev => prev.map(f => f.id === id ? data.fact : f));
    }
    setEditingId(null);
  }

  async function deleteFact(id: string) {
    await fetch(`/api/brain/facts/${id}`, { method: 'DELETE' });
    setFacts(prev => prev.filter(f => f.id !== id));
  }

  const grouped = facts.reduce<Record<string, BrainFact[]>>((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    (acc[f.category] as BrainFact[]).push(f);
    return acc;
  }, {});

  const completeness = brain?.completeness_score ?? 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-[var(--color-text-muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-h1 text-[var(--color-text)]">Business Brain</h1>
          <p className="mt-1 text-body-sm text-[var(--color-text-secondary)]">
            Describe your product, ICP, and value proposition. The AI extracts structured facts
            that personalize every research report and outreach message.
          </p>
        </div>
        {brain && (
          <div className="shrink-0 ml-6 text-right">
            <p className="text-xs text-[var(--color-text-muted)]">Completeness</p>
            <p className="text-display text-[var(--color-text)] tabular-nums">{Math.round(completeness)}%</p>
          </div>
        )}
      </div>

      {brain && completeness > 0 && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]">
          <div
            className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-700"
            style={{ width: `${completeness}%` }}
          />
        </div>
      )}

      {/* Text extraction input */}
      <div className="mt-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="text-h2 text-[var(--color-text)] mb-1">Add context</h2>
        <p className="text-body-sm text-[var(--color-text-secondary)] mb-3">
          Paste your website copy, elevator pitch, pricing page, or any description of your business.
        </p>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          rows={6}
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          placeholder="We help B2B SaaS companies close more enterprise deals by…"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => void extract()}
            disabled={extracting || !text.trim()}
            className="px-4 py-2 rounded-md bg-[var(--color-primary)] text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {extracting ? 'Extracting…' : 'Extract facts with AI'}
          </button>
          {extractResult && (
            <p className={`text-sm ${extractResult.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
              {extractResult}
            </p>
          )}
        </div>
      </div>

      {/* Facts by category */}
      {facts.length > 0 ? (
        <div className="mt-8 space-y-6">
          <h2 className="text-h2 text-[var(--color-text)]">Extracted facts</h2>
          {Object.entries(grouped).map(([cat, catFacts]) => (
            <div key={cat}>
              <h3 className="text-label uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
                {CATEGORY_LABELS[cat] ?? cat}
              </h3>
              <div className="space-y-2">
                {catFacts.map(fact => (
                  <div
                    key={fact.id}
                    className="flex items-start gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--color-text-muted)] mb-0.5">{fact.key}</p>
                      {editingId === fact.id ? (
                        <div className="flex gap-2 mt-1">
                          <input
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') void saveFact(fact.id); if (e.key === 'Escape') setEditingId(null); }}
                            className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm text-[var(--color-text)]"
                          />
                          <button onClick={() => void saveFact(fact.id)} className="text-xs text-[var(--color-primary)]">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-xs text-[var(--color-text-muted)]">Cancel</button>
                        </div>
                      ) : (
                        <p className="text-body-sm text-[var(--color-text)]">{fact.value}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${fact.confidence === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {fact.confidence}
                      </span>
                      <button
                        onClick={() => { setEditingId(fact.id); setEditValue(fact.value); }}
                        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void deleteFact(fact.id)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        brain && (
          <div className="mt-8 rounded-lg border border-dashed border-[var(--color-border)] p-10 text-center">
            <p className="text-[var(--color-text-muted)]">No facts yet. Paste some text above and extract facts with AI.</p>
          </div>
        )
      )}

      {!brain && facts.length === 0 && !loading && (
        <div className="mt-8 rounded-lg border border-dashed border-[var(--color-border)] p-10 text-center">
          <p className="text-[var(--color-text-muted)]">Your Business Brain is empty. Add some context above to get started.</p>
        </div>
      )}
    </div>
  );
}
