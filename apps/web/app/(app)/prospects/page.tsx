'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Upload, Search } from 'lucide-react';
import Link from 'next/link';
import { LinkButton } from '@/components/ui/link-button';

interface Prospect {
  id: string;
  full_name: string;
  company_name: string | null;
  professional_title: string | null;
  linkedin_url: string | null;
  status: 'new' | 'researched' | 'ready' | 'sent' | 'replied' | 'not_interested' | 'converted';
  last_activity_at: string | null;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-700',
  researched: 'bg-blue-100 text-blue-700',
  ready: 'bg-purple-100 text-purple-700',
  sent: 'bg-yellow-100 text-yellow-700',
  replied: 'bg-green-100 text-green-700',
  not_interested: 'bg-red-100 text-red-700',
  converted: 'bg-emerald-100 text-emerald-700',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'researched', label: 'Researched' },
  { value: 'ready', label: 'Ready' },
  { value: 'sent', label: 'Sent' },
  { value: 'replied', label: 'Replied' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'converted', label: 'Converted' },
];

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/prospects?${params}`);
    if (res.ok) {
      const data = await res.json() as { prospects: Prospect[]; pagination: Pagination };
      setProspects(data.prospects ?? []);
      setPagination(data.pagination ?? null);
    }
    setLoading(false);
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-[var(--color-text)]">Prospects</h1>
          <p className="mt-1 text-body-sm text-[var(--color-text-secondary)]">
            Research and manage your LinkedIn prospects
            {pagination && pagination.total > 0 && (
              <span className="ml-2 text-[var(--color-text-muted)]">({pagination.total})</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton href="/prospects/bulk" variant="secondary" size="md">
            <Upload className="h-4 w-4" />
            Bulk upload
          </LinkButton>
          <LinkButton href="/prospects/new" size="md">
            <Plus className="h-4 w-4" />
            Add prospect
          </LinkButton>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-5 flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search prospects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-9 pr-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="mt-8 flex justify-center">
          <p className="text-[var(--color-text-muted)]">Loading…</p>
        </div>
      ) : prospects.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] py-16 text-center">
          <h3 className="text-h3 text-[var(--color-text)]">
            {debouncedSearch || statusFilter ? 'No prospects match your filters' : 'No prospects yet'}
          </h3>
          <p className="mt-1 text-body-sm text-[var(--color-text-muted)]">
            {debouncedSearch || statusFilter
              ? 'Try a different search or filter.'
              : 'Add a LinkedIn URL to research your first prospect.'}
          </p>
          {!debouncedSearch && !statusFilter && (
            <div className="mt-4 flex gap-2">
              <LinkButton href="/prospects/new" size="md">Add prospect</LinkButton>
              <LinkButton href="/prospects/bulk" variant="secondary" size="md">Bulk upload</LinkButton>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="mt-5 overflow-hidden rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-muted,var(--color-surface))] border-b border-[var(--color-border)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide hidden sm:table-cell">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide hidden lg:table-cell">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                {prospects.map(p => (
                  <tr key={p.id} className="hover:bg-[var(--color-surface-hover,var(--color-bg))] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/prospects/${p.id}`} className="font-medium text-[var(--color-text)] hover:text-[var(--color-primary)]">
                        {p.full_name}
                      </Link>
                      {p.professional_title && (
                        <p className="text-xs text-[var(--color-text-muted)]">{p.professional_title}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] hidden sm:table-cell">
                      {p.company_name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {p.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)] hidden lg:table-cell">
                      {p.last_activity_at
                        ? new Date(p.last_activity_at).toLocaleDateString()
                        : new Date(p.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-[var(--color-text-muted)]">
                Page {pagination.page} of {pagination.total_pages}
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-text)] disabled:opacity-50 hover:bg-[var(--color-surface)]"
                >
                  Previous
                </button>
                <button
                  disabled={page >= pagination.total_pages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-text)] disabled:opacity-50 hover:bg-[var(--color-surface)]"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
