'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: '⌂' },
  { href: '/prospects', label: 'Prospects', icon: '👤' },
  { href: '/brain', label: 'Business Brain', icon: '🧠' },
  { href: '/bulk', label: 'Bulk Upload', icon: '⬆' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

interface AppNavProps {
  userId: string;
  userEmail: string;
}

export function AppNav({ userEmail }: AppNavProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-card border-r border-border flex flex-col">
      <div className="p-5 border-b border-border">
        <span className="font-display text-xl text-foreground">Flintel</span>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              pathname.startsWith(item.href)
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
      </div>
    </aside>
  );
}
