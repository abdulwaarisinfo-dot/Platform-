'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface BulkUploadFormProps {
  maxUrls: number;
}

export function BulkUploadForm({ maxUrls }: BulkUploadFormProps) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const count = lines.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (count === 0) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/prospects/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: lines, name: name || undefined }),
      });

      const data = await res.json() as { batch_job_id?: string; error?: string };

      if (!res.ok) {
        setError(data.error ?? 'Failed to start batch');
        return;
      }

      router.push(`/prospects/bulk/${data.batch_job_id}`);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="batch-name" className="mb-1.5 block text-sm font-medium text-gray-700">
          Batch name (optional)
        </label>
        <input
          id="batch-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Batch ${new Date().toLocaleDateString()}`}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="urls" className="block text-sm font-medium text-gray-700">
            LinkedIn URLs
          </label>
          <span className={`text-xs ${count > maxUrls ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
            {count} / {maxUrls}
          </span>
        </div>
        <textarea
          id="urls"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder={`https://linkedin.com/in/jane-doe\nhttps://linkedin.com/in/john-smith\n...`}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">One LinkedIn profile URL per line.</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <button
        type="submit"
        disabled={loading || count === 0 || count > maxUrls}
        className="w-full rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Starting batch…' : `Research ${count > 0 ? count : ''} Profiles`}
      </button>
    </form>
  );
}
