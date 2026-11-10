'use client';

import { useEffect, useRef, useState } from 'react';

interface BatchJob {
  id: string;
  name: string | null;
  status: string;
  total_urls: number;
  completed_urls: number;
  failed_count: number;
  skipped_count: number;
  created_at: string;
  completed_at: string | null;
}

interface BatchProgressProps {
  job: BatchJob;
  onComplete?: (job: BatchJob) => void;
}

export function BatchProgress({ job: initialJob, onComplete }: BatchProgressProps) {
  const [job, setJob] = useState<BatchJob>(initialJob);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (['completed', 'cancelled', 'failed'].includes(job.status)) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/prospects/bulk/${job.id}`);
        if (!res.ok) return;
        const data = await res.json();
        const updated: BatchJob = {
          id: data.id,
          name: data.name ?? null,
          status: data.status,
          total_urls: data.total_urls ?? 0,
          completed_urls: data.completed_urls ?? 0,
          failed_count: data.failed_count ?? 0,
          skipped_count: data.skipped_count ?? 0,
          created_at: data.created_at,
          completed_at: data.completed_at ?? null,
        };
        setJob(updated);
        if (['completed', 'cancelled', 'failed'].includes(updated.status)) {
          clearInterval(interval);
          onCompleteRef.current?.(updated);
        }
      } catch {
        // network error — will retry on next tick
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [job.id, job.status]);

  const total = job.total_urls || 1;
  const done = (job.completed_urls ?? 0) + (job.failed_count ?? 0) + (job.skipped_count ?? 0);
  const pct = Math.round((done / total) * 100);

  const statusColor: Record<string, string> = {
    pending: 'text-yellow-600',
    processing: 'text-blue-600',
    completed: 'text-green-600',
    cancelled: 'text-gray-500',
    failed: 'text-red-600',
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900">{job.name}</p>
          <p className={`text-sm font-medium capitalize ${statusColor[job.status] ?? 'text-gray-600'}`}>
            {job.status}
          </p>
        </div>
        <div className="text-right text-sm text-gray-500">
          <p>{done} / {job.total_urls}</p>
          <p>{pct}%</p>
        </div>
      </div>

      <div className="mb-3 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            job.status === 'failed' ? 'bg-red-500' :
            job.status === 'cancelled' ? 'bg-gray-400' :
            job.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex gap-4 text-xs text-gray-500">
        <span className="text-green-600">✓ {job.completed_urls ?? 0} done</span>
        {(job.failed_count ?? 0) > 0 && (
          <span className="text-red-500">✗ {job.failed_count} failed</span>
        )}
        {(job.skipped_count ?? 0) > 0 && (
          <span>– {job.skipped_count} skipped</span>
        )}
      </div>
    </div>
  );
}
