'use client';

import { useState } from 'react';

interface PlanCardProps {
  id: string;
  name: string;
  price: number;
  prospects: number;
  messages: number;
  bulk: boolean;
  maxBatch: number;
  current?: boolean;
  recommended?: boolean;
}

export function PlanCard({
  id,
  name,
  price,
  prospects,
  messages,
  bulk,
  maxBatch,
  current,
  recommended,
}: PlanCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleUpgrade() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: id, billing_cycle: 'monthly' }),
      });
      const data = await res.json() as { checkout_url?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Checkout failed');
        return;
      }
      window.location.href = data.checkout_url!;
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 ${
        recommended
          ? 'border-blue-500 shadow-lg shadow-blue-100'
          : 'border-gray-200'
      } bg-white`}
    >
      {recommended && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white">
          Most popular
        </span>
      )}

      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900">{name}</h3>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-4xl font-bold text-gray-900">${price}</span>
          <span className="text-gray-500">/mo</span>
        </div>
      </div>

      <ul className="mb-8 flex-1 space-y-3 text-sm text-gray-600">
        <li className="flex items-center gap-2">
          <Check />
          {prospects} prospect reports/month
        </li>
        <li className="flex items-center gap-2">
          <Check />
          {messages} AI messages/month
        </li>
        <li className="flex items-center gap-2">
          <Check />
          Business Brain intelligence
        </li>
        <li className="flex items-center gap-2">
          <Check />
          CRM &amp; follow-up tracker
        </li>
        {bulk ? (
          <li className="flex items-center gap-2">
            <Check />
            Bulk upload (up to {maxBatch} URLs)
          </li>
        ) : (
          <li className="flex items-center gap-2 opacity-40">
            <X />
            Bulk upload
          </li>
        )}
      </ul>

      {error && <p className="mb-3 text-xs text-red-600">{error}</p>}

      <button
        onClick={handleUpgrade}
        disabled={loading || current}
        className={`w-full rounded-lg px-5 py-2.5 text-sm font-semibold transition ${
          current
            ? 'cursor-default bg-gray-100 text-gray-500'
            : recommended
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
        } disabled:opacity-60`}
      >
        {loading ? 'Loading…' : current ? 'Current plan' : `Upgrade to ${name}`}
      </button>
    </div>
  );
}

function Check() {
  return (
    <svg className="h-4 w-4 flex-shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function X() {
  return (
    <svg className="h-4 w-4 flex-shrink-0 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}
