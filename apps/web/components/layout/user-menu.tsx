"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut, Settings, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

interface UserMenuProps {
  email: string | null | undefined;
  name?: string | null;
}

export function UserMenu({ email, name }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }

  if (!email) return null;

  const display = name ?? email;
  const initials = display.slice(0, 2).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--color-surface-raised)] transition-colors"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent-subtle)] text-[12px] font-semibold text-[var(--color-accent-text)]">
          {initials}
        </span>
        <span className="text-[14px] text-[var(--color-text-secondary)]">
          {email}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 min-w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg py-1">
            <a
              href="/settings"
              className="flex items-center gap-2.5 px-4 py-2 text-[14px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]"
              onClick={() => setOpen(false)}
            >
              <Settings className="h-4 w-4" />
              Settings
            </a>
            <div className="my-1 border-t border-[var(--color-border)]" />
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-[14px] text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)]"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
