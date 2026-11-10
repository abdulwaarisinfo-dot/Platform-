'use client';

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-label text-[var(--color-text-muted)]">404</p>
        <h1 className="mt-2 text-h1 text-[var(--color-text)]">Page not found</h1>
        <p className="mt-2 text-body-sm text-[var(--color-text-secondary)]">
          This page doesn&apos;t exist or was moved.
        </p>
        <div className="mt-6">
          <Link href="/dashboard" className={buttonVariants()}>
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
