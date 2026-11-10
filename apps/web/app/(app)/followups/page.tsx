'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Prospect {
  id: string;
  full_name: string;
  company_name: string | null;
  professional_title: string | null;
}

interface Followup {
  id: string;
  due_at: string;
  note: string | null;
  prospects: Prospect;
}

export default function FollowupsPage() {
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/followups?status=pending&limit=100');
    if (res.ok) {
      const data = await res.json() as { followups: Followup[] };
      setFollowups(data.followups ?? []);
    }
    setLoading(false);
  }

  async function markDone(id: string) {
    setMarking(id);
    await fetch(`/api/followups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed_at: new Date().toISOString() }),
    });
    setFollowups(prev => prev.filter(f => f.id !== id));
    setMarking(null);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);

  const overdue = followups.filter(f => new Date(f.due_at) < today);
  const dueToday = followups.filter(f => {
    const d = new Date(f.due_at);
    return d >= today && d < tomorrow;
  });
  const upcoming = followups.filter(f => new Date(f.due_at) >= tomorrow);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-[var(--color-text-muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-h1 text-[var(--color-text)]">Follow-ups</h1>

      {overdue.length > 0 && (
        <Section title={`Overdue (${overdue.length})`} urgent>
          {overdue.map(f => <Card key={f.id} f={f} urgent onDone={markDone} busy={marking === f.id} />)}
        </Section>
      )}

      {dueToday.length > 0 && (
        <Section title={`Today (${dueToday.length})`}>
          {dueToday.map(f => <Card key={f.id} f={f} onDone={markDone} busy={marking === f.id} />)}
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title="Upcoming">
          {upcoming.map(f => <Card key={f.id} f={f} onDone={markDone} busy={marking === f.id} />)}
        </Section>
      )}

      {followups.length === 0 && (
        <div className="mt-8 rounded-lg border border-dashed border-[var(--color-border)] p-10 text-center">
          <p className="text-lg font-medium text-[var(--color-text)]">No pending follow-ups</p>
          <p className="mt-1 text-body-sm text-[var(--color-text-secondary)]">
            Add follow-ups from a prospect&apos;s profile page.
          </p>
        </div>
      )}
    </div>
  );
}

function Section({ title, urgent, children }: { title: string; urgent?: boolean; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className={`mb-3 text-sm font-semibold uppercase tracking-wide ${urgent ? 'text-red-600' : 'text-[var(--color-text-muted)]'}`}>
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Card({ f, urgent, onDone, busy }: { f: Followup; urgent?: boolean; onDone: (id: string) => void; busy: boolean }) {
  const p = f.prospects;
  return (
    <div className={`rounded-lg border p-4 ${urgent ? 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href={`/prospects/${p.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
            {p.full_name}
          </Link>
          {(p.professional_title || p.company_name) && (
            <p className="text-sm text-[var(--color-text-secondary)]">
              {[p.professional_title, p.company_name].filter(Boolean).join(' at ')}
            </p>
          )}
          {f.note && <p className="mt-1 text-sm text-[var(--color-text)]">{f.note}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="text-xs text-[var(--color-text-muted)]">
            {new Date(f.due_at).toLocaleDateString()}
          </span>
          <button
            onClick={() => onDone(f.id)}
            disabled={busy}
            className="rounded px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
          >
            {busy ? '…' : 'Mark done'}
          </button>
        </div>
      </div>
    </div>
  );
}
