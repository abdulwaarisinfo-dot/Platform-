'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Mode = 'linkedin' | 'manual';

export default function NewProspectPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('linkedin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    full_name: '',
    company_name: '',
    professional_title: '',
    linkedin_url: '',
    company_website: '',
    user_provided_bio: '',
  });

  function update(key: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const payload: Record<string, string> = {};

    if (mode === 'linkedin') {
      if (!form.linkedin_url.trim()) {
        setError('LinkedIn URL is required');
        setLoading(false);
        return;
      }
      payload.full_name = form.full_name || 'TBD';
      payload.linkedin_url = form.linkedin_url.trim();
    } else {
      if (!form.full_name.trim()) {
        setError('Full name is required');
        setLoading(false);
        return;
      }
      payload.full_name = form.full_name.trim();
      if (form.company_name) payload.company_name = form.company_name;
      if (form.professional_title) payload.professional_title = form.professional_title;
      if (form.company_website) payload.company_website = form.company_website;
      if (form.user_provided_bio) payload.user_provided_bio = form.user_provided_bio;
    }

    const res = await fetch('/api/prospects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json() as { prospect?: { id: string }; error?: { message: string } };

    if (!res.ok) {
      setError(data.error?.message ?? 'Failed to create prospect');
      setLoading(false);
      return;
    }

    router.push(`/prospects/${data.prospect!.id}`);
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-h1 text-[var(--color-text)]">Add prospect</h1>
      <p className="mt-1 text-body-sm text-[var(--color-text-secondary)]">
        Choose how you want to research this prospect.
      </p>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setMode('linkedin')}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
            mode === 'linkedin'
              ? 'bg-[var(--color-primary)] text-white border-transparent'
              : 'bg-transparent text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-surface)]'
          }`}
        >
          LinkedIn URL
        </button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
            mode === 'manual'
              ? 'bg-[var(--color-primary)] text-white border-transparent'
              : 'bg-transparent text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-surface)]'
          }`}
        >
          Manual entry
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {mode === 'linkedin' ? (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-text)]">
                LinkedIn profile URL
              </label>
              <Input
                type="url"
                placeholder="https://linkedin.com/in/username"
                value={form.linkedin_url}
                onChange={e => update('linkedin_url', e.target.value)}
                required
              />
              <p className="text-xs text-[var(--color-text-muted)]">
                We&apos;ll use PDL enrichment and web research to build a full profile.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-text)]">
                Name <span className="text-[var(--color-text-muted)]">(optional — we&apos;ll detect it)</span>
              </label>
              <Input
                placeholder="Alex Johnson"
                value={form.full_name}
                onChange={e => update('full_name', e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-text)]">Full name *</label>
              <Input
                placeholder="Alex Johnson"
                value={form.full_name}
                onChange={e => update('full_name', e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-text)]">Company</label>
                <Input
                  placeholder="Acme Corp"
                  value={form.company_name}
                  onChange={e => update('company_name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-text)]">Job title</label>
                <Input
                  placeholder="VP of Sales"
                  value={form.professional_title}
                  onChange={e => update('professional_title', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-text)]">Company website</label>
              <Input
                type="url"
                placeholder="https://acme.com"
                value={form.company_website}
                onChange={e => update('company_website', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-text)]">
                Notes / bio <span className="text-[var(--color-text-muted)]">(optional)</span>
              </label>
              <Textarea
                placeholder="Anything you already know about this person or company…"
                rows={4}
                value={form.user_provided_bio}
                onChange={e => update('user_provided_bio', e.target.value)}
              />
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? 'Adding…' : 'Add prospect'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
