'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function BillingSuccessPage() {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const t = setInterval(() => setCountdown(n => n - 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      window.location.href = '/settings';
    }
  }, [countdown]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="rounded-full bg-green-100 p-4 dark:bg-green-900/30">
        <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="mt-6 text-2xl font-semibold text-[var(--color-text)]">Payment successful!</h1>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        Your subscription is now active. Credits have been added to your account.
      </p>
      <p className="mt-4 text-sm text-[var(--color-text-muted)]">
        Redirecting to settings in {countdown}s…
      </p>
      <Link
        href="/settings"
        className="mt-6 rounded-md bg-[var(--color-primary)] px-5 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Go to settings
      </Link>
    </div>
  );
}
