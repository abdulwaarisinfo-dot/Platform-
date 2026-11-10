'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';

interface ResearchData {
  research_id: string;
  status: string;
  enrichment_confidence: string;
  enrichment_matched: boolean | null;
  professional_summary: string;
  company_summary: string;
  recent_developments: string[];
  potential_signals: string[];
  confidence: string;
  gaps: string[];
  sources: Array<{ url: string; title: string; snippet: string }>;
  cached: boolean;
  cost_usd: number;
}

interface OpportunityData {
  opportunity_id: string;
  overall_score: number;
  relevance_score: number;
  signal_score: number;
  fit_score: number;
  timing_score: number;
  primary_opportunity: string;
  supporting_evidence: Array<{ point: string; source: string | null; confidence: string }>;
  weak_points: string[];
  recommended_angle: string;
  score_explanation: string;
}

interface MessageData {
  id: string;
  message_type: string;
  subject: string | null;
  body: string;
  version: number;
  character_count: number;
  created_at: string;
}

interface ProspectData {
  id: string;
  full_name: string;
  company_name: string | null;
  professional_title: string | null;
  linkedin_url: string | null;
  status: string;
  connection_status: string | null;
  notes: string | null;
  created_at: string;
}

interface FollowupData {
  id: string;
  due_at: string;
  note: string | null;
  completed_at: string | null;
}

type Tab = 'overview' | 'research' | 'outreach';

export default function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [prospect, setProspect] = useState<ProspectData | null>(null);
  const [research, setResearch] = useState<ResearchData | null>(null);
  const [opportunity, setOpportunity] = useState<OpportunityData | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [followups, setFollowups] = useState<FollowupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [researchLoading, setResearchLoading] = useState(false);
  const [opportunityLoading, setOpportunityLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/prospects/${id}`);
      if (!res.ok) { router.push('/prospects'); return; }
      const data = await res.json() as {
        prospect: ProspectData;
        research: ResearchData | null;
        opportunity: OpportunityData | null;
        messages: MessageData[];
      };
      setProspect(data.prospect);
      setResearch(data.research);
      setOpportunity(data.opportunity);
      setMessages(data.messages ?? []);

      const fRes = await fetch(`/api/followups?prospect_id=${id}&status=pending&limit=20`);
      if (fRes.ok) {
        const fData = await fRes.json() as { followups: FollowupData[] };
        setFollowups(fData.followups ?? []);
      }

      setLoading(false);
    }
    void load();
  }, [id, router]);

  async function runResearch() {
    setResearchLoading(true);
    const res = await fetch(`/api/prospects/${id}/research`, { method: 'POST' });
    const data = await res.json() as ResearchData;
    if (res.ok) {
      setResearch(data);
      setProspect(prev => prev ? { ...prev, status: 'researched' } : prev);
    }
    setResearchLoading(false);
  }

  async function runOpportunity() {
    if (!research) return;
    setOpportunityLoading(true);
    const res = await fetch(`/api/prospects/${id}/opportunity`, { method: 'POST' });
    const data = await res.json() as OpportunityData;
    if (res.ok) {
      setOpportunity(data);
      setProspect(prev => prev ? { ...prev, status: 'ready' } : prev);
    }
    setOpportunityLoading(false);
  }

  if (loading || !prospect) {
    return <div className="p-6 text-[var(--color-text-muted)]">Loading…</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-h1 text-[var(--color-text)]">{prospect.full_name}</h1>
          {(prospect.company_name || prospect.professional_title) && (
            <p className="mt-1 text-body-sm text-[var(--color-text-secondary)]">
              {[prospect.professional_title, prospect.company_name].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {!research && (
            <button
              onClick={() => void runResearch()}
              disabled={researchLoading}
              className="px-4 py-2 rounded-md bg-[var(--color-primary)] text-white text-sm font-medium disabled:opacity-50"
            >
              {researchLoading ? 'Researching…' : 'Run research'}
            </button>
          )}
          {research && !opportunity && (
            <button
              onClick={() => void runOpportunity()}
              disabled={opportunityLoading}
              className="px-4 py-2 rounded-md bg-[var(--color-primary)] text-white text-sm font-medium disabled:opacity-50"
            >
              {opportunityLoading ? 'Scoring…' : 'Score opportunity'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 border-b border-[var(--color-border)]">
        <nav className="flex gap-1">
          {(['overview', 'research', 'outreach'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                tab === t
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {tab === 'overview' && (
          <OverviewTab
            prospect={prospect}
            opportunity={opportunity}
            followups={followups}
            onProspectUpdated={updated => setProspect(prev => prev ? { ...prev, ...updated } : prev)}
            onFollowupAdded={f => setFollowups(prev => [...prev, f])}
            onFollowupDone={fid => setFollowups(prev => prev.filter(f => f.id !== fid))}
          />
        )}
        {tab === 'research' && (
          <ResearchTab research={research} onRunResearch={() => void runResearch()} loading={researchLoading} />
        )}
        {tab === 'outreach' && (
          <OutreachTab
            prospectId={id}
            opportunity={opportunity}
            messages={messages}
            onMessageGenerated={msg => setMessages(prev => [msg, ...prev])}
          />
        )}
      </div>
    </div>
  );
}

const CONNECTION_OPTIONS = [
  { value: '', label: 'Unknown' },
  { value: 'not_connected', label: 'Not connected' },
  { value: 'pending', label: 'Request sent' },
  { value: 'connected', label: 'Connected' },
  { value: 'replied', label: 'Replied' },
];

function OverviewTab({
  prospect,
  opportunity,
  followups,
  onProspectUpdated,
  onFollowupAdded,
  onFollowupDone,
}: {
  prospect: ProspectData;
  opportunity: OpportunityData | null;
  followups: FollowupData[];
  onProspectUpdated: (u: Partial<ProspectData>) => void;
  onFollowupAdded: (f: FollowupData) => void;
  onFollowupDone: (id: string) => void;
}) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(prospect.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingConnection, setSavingConnection] = useState(false);
  const [showFollowupForm, setShowFollowupForm] = useState(false);
  const [followupDate, setFollowupDate] = useState('');
  const [followupNote, setFollowupNote] = useState('');
  const [savingFollowup, setSavingFollowup] = useState(false);

  async function saveNotes() {
    setSavingNotes(true);
    const res = await fetch(`/api/prospects/${prospect.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    if (res.ok) {
      onProspectUpdated({ notes });
      setEditingNotes(false);
    }
    setSavingNotes(false);
  }

  async function saveConnectionStatus(value: string) {
    setSavingConnection(true);
    const res = await fetch(`/api/prospects/${prospect.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connection_status: value || null }),
    });
    if (res.ok) onProspectUpdated({ connection_status: value || null });
    setSavingConnection(false);
  }

  async function addFollowup() {
    if (!followupDate) return;
    setSavingFollowup(true);
    const res = await fetch('/api/followups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prospect_id: prospect.id,
        due_at: new Date(followupDate).toISOString(),
        note: followupNote || null,
      }),
    });
    if (res.ok) {
      const data = await res.json() as { followup: FollowupData };
      onFollowupAdded(data.followup);
      setShowFollowupForm(false);
      setFollowupDate('');
      setFollowupNote('');
    }
    setSavingFollowup(false);
  }

  async function markFollowupDone(id: string) {
    await fetch(`/api/followups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed_at: new Date().toISOString() }),
    });
    onFollowupDone(id);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left column */}
      <div className="space-y-5">
        {/* Contact info */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h3 className="text-label text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Contact info</h3>
          <dl className="space-y-2">
            {prospect.linkedin_url && (
              <Row label="LinkedIn" value={
                <a href={prospect.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline truncate block">
                  {prospect.linkedin_url.replace('https://www.', '')}
                </a>
              } />
            )}
            <Row label="Status" value={<span className="capitalize">{prospect.status.replace(/_/g, ' ')}</span>} />
            <Row label="Connection" value={
              <select
                value={prospect.connection_status ?? ''}
                onChange={e => void saveConnectionStatus(e.target.value)}
                disabled={savingConnection}
                className="text-sm bg-transparent text-[var(--color-text)] border-0 p-0 focus:outline-none disabled:opacity-50"
              >
                {CONNECTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            } />
          </dl>
        </div>

        {/* Notes */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-label text-[var(--color-text-muted)] uppercase tracking-wide">Notes</h3>
            {!editingNotes && (
              <button onClick={() => setEditingNotes(true)} className="text-xs text-[var(--color-primary)]">
                {prospect.notes ? 'Edit' : 'Add note'}
              </button>
            )}
          </div>
          {editingNotes ? (
            <div className="space-y-2">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                placeholder="Add notes about this prospect…"
              />
              <div className="flex gap-2">
                <button onClick={() => void saveNotes()} disabled={savingNotes} className="text-xs text-[var(--color-primary)] disabled:opacity-50">
                  {savingNotes ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => { setEditingNotes(false); setNotes(prospect.notes ?? ''); }} className="text-xs text-[var(--color-text-muted)]">Cancel</button>
              </div>
            </div>
          ) : (
            <p className="text-body-sm text-[var(--color-text)]">
              {prospect.notes ?? <span className="text-[var(--color-text-muted)]">No notes yet.</span>}
            </p>
          )}
        </div>
      </div>

      {/* Right column */}
      <div className="space-y-5">
        {/* Opportunity score */}
        {opportunity && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h3 className="text-label text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Opportunity score</h3>
            <div className="text-5xl font-bold text-[var(--color-text)] tabular-nums">
              {opportunity.overall_score}
              <span className="text-xl text-[var(--color-text-muted)]">/100</span>
            </div>
            <p className="mt-3 text-body-sm text-[var(--color-text-secondary)]">{opportunity.primary_opportunity}</p>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">{opportunity.score_explanation}</p>
          </div>
        )}

        {/* Follow-ups */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-label text-[var(--color-text-muted)] uppercase tracking-wide">Follow-ups</h3>
            <button onClick={() => setShowFollowupForm(v => !v)} className="text-xs text-[var(--color-primary)]">
              {showFollowupForm ? 'Cancel' : '+ Add'}
            </button>
          </div>

          {showFollowupForm && (
            <div className="mb-4 space-y-2 rounded border border-[var(--color-border)] p-3">
              <input
                type="date"
                value={followupDate}
                onChange={e => setFollowupDate(e.target.value)}
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm text-[var(--color-text)]"
              />
              <input
                type="text"
                value={followupNote}
                onChange={e => setFollowupNote(e.target.value)}
                placeholder="Note (optional)"
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
              />
              <button
                onClick={() => void addFollowup()}
                disabled={!followupDate || savingFollowup}
                className="text-xs text-[var(--color-primary)] disabled:opacity-50"
              >
                {savingFollowup ? 'Saving…' : 'Save follow-up'}
              </button>
            </div>
          )}

          {followups.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">No pending follow-ups.</p>
          ) : (
            <ul className="space-y-2">
              {followups.map(f => (
                <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                  <div>
                    <span className="text-[var(--color-text)]">{new Date(f.due_at).toLocaleDateString()}</span>
                    {f.note && <span className="ml-2 text-[var(--color-text-muted)]">{f.note}</span>}
                  </div>
                  <button onClick={() => void markFollowupDone(f.id)} className="text-xs text-green-600 hover:underline shrink-0">
                    Done
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="text-sm text-[var(--color-text-muted)] w-24 shrink-0">{label}</dt>
      <dd className="text-sm text-[var(--color-text)] min-w-0">{value}</dd>
    </div>
  );
}

function ResearchTab({ research, onRunResearch, loading }: {
  research: ResearchData | null;
  onRunResearch: () => void;
  loading: boolean;
}) {
  if (!research) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-border)] p-10 text-center">
        <p className="text-[var(--color-text-muted)]">No research yet.</p>
        <button
          onClick={onRunResearch}
          disabled={loading}
          className="mt-3 px-4 py-2 rounded-md bg-[var(--color-primary)] text-white text-sm disabled:opacity-50"
        >
          {loading ? 'Researching…' : 'Run research'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
        <span className={`px-2 py-0.5 rounded-full ${research.enrichment_confidence === 'enriched' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
          {research.enrichment_confidence}
        </span>
        <span>Confidence: {research.confidence}</span>
        {research.cached && <span>Cached result</span>}
        {research.cost_usd > 0 && <span>${research.cost_usd.toFixed(4)} cost</span>}
      </div>

      <Section title="Professional summary" content={research.professional_summary} />
      <Section title="Company" content={research.company_summary} />

      {research.recent_developments.length > 0 && (
        <div>
          <h3 className="text-label uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Recent developments</h3>
          <ul className="space-y-1">
            {research.recent_developments.map((d, i) => (
              <li key={i} className="text-body-sm text-[var(--color-text)] flex gap-2">
                <span className="text-[var(--color-text-muted)]">·</span>
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {research.potential_signals.length > 0 && (
        <div>
          <h3 className="text-label uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Signals</h3>
          <ul className="space-y-1">
            {research.potential_signals.map((s, i) => (
              <li key={i} className="text-body-sm text-[var(--color-text)] flex gap-2">
                <span className="text-green-500">↑</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {research.gaps.length > 0 && (
        <div>
          <h3 className="text-label uppercase tracking-wide text-[var(--color-text-muted)] mb-2">Gaps</h3>
          <ul className="space-y-1">
            {research.gaps.map((g, i) => (
              <li key={i} className="text-xs text-[var(--color-text-muted)]">· {g}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <h3 className="text-label uppercase tracking-wide text-[var(--color-text-muted)] mb-2">{title}</h3>
      <p className="text-body-sm text-[var(--color-text)]">{content}</p>
    </div>
  );
}

function OutreachTab({ prospectId, opportunity, messages, onMessageGenerated }: {
  prospectId: string;
  opportunity: OpportunityData | null;
  messages: MessageData[];
  onMessageGenerated: (msg: MessageData) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [selectedType, setSelectedType] = useState('linkedin_connection_request');
  const [copied, setCopied] = useState<string | null>(null);

  const MESSAGE_TYPES = [
    { value: 'linkedin_connection_request', label: 'LinkedIn connection' },
    { value: 'linkedin_direct_message', label: 'LinkedIn DM' },
    { value: 'cold_email', label: 'Cold email' },
    { value: 'short_intro', label: 'Short intro' },
    { value: 'followup_no_response', label: 'Follow-up (no reply)' },
    { value: 'followup_after_reply', label: 'Follow-up (after reply)' },
  ];

  async function generate() {
    if (!opportunity) return;
    setGenerating(true);

    const res = await fetch(`/api/prospects/${prospectId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message_type: selectedType,
        opportunity_id: opportunity.opportunity_id,
      }),
    });

    if (res.ok) {
      const data = await res.json() as MessageData;
      onMessageGenerated(data);
    }
    setGenerating(false);
  }

  async function copy(msg: MessageData) {
    await navigator.clipboard.writeText(msg.body);
    setCopied(msg.id);
    setTimeout(() => setCopied(null), 2000);
  }

  if (!opportunity) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-border)] p-10 text-center">
        <p className="text-[var(--color-text-muted)]">Score the opportunity first to generate messages.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <select
          value={selectedType}
          onChange={e => setSelectedType(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
        >
          {MESSAGE_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button
          onClick={() => void generate()}
          disabled={generating}
          className="px-4 py-2 rounded-md bg-[var(--color-primary)] text-white text-sm font-medium disabled:opacity-50"
        >
          {generating ? 'Generating…' : 'Generate message'}
        </button>
      </div>

      {messages.map(msg => (
        <div key={msg.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--color-text-muted)] capitalize">
                {msg.message_type.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">v{msg.version}</span>
              <span className="text-xs text-[var(--color-text-muted)]">{msg.character_count} chars</span>
            </div>
            <button
              onClick={() => void copy(msg)}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              {copied === msg.id ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {msg.subject && (
            <p className="text-sm font-medium text-[var(--color-text)] mb-2">Subject: {msg.subject}</p>
          )}
          <p className="text-body-sm text-[var(--color-text)] whitespace-pre-wrap">{msg.body}</p>
        </div>
      ))}
    </div>
  );
}
