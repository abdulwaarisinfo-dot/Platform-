import type { Metadata } from "next";
import { getAuthSession } from "@/lib/session";
import { prospects, generatedMessages, usageRecords, toId } from "@/lib/mongodb/collections";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await getAuthSession();
  if (!session) return null;

  const userId = session.user.id;
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalProspects,
    researchedProspects,
    messagesSent,
    usage,
    recentProspects,
  ] = await Promise.all([
    (await prospects()).countDocuments({ user_id: userId, archived_at: null }),
    (await prospects()).countDocuments({ user_id: userId, archived_at: null, status: { $ne: 'new' } }),
    (await generatedMessages()).countDocuments({ user_id: userId, created_at: { $gte: periodStart } }),
    (await usageRecords()).findOne({ user_id: userId }),
    (await prospects())
      .find({ user_id: userId, archived_at: null })
      .sort({ last_activity_at: -1 })
      .limit(5)
      .toArray(),
  ]);

  const researchUsed = (usage?.prospect_research_used as number) ?? 0;
  const researchLimit = (usage?.prospect_research_limit as number) ?? 0;
  const researchPct = researchLimit > 0 ? Math.min(100, Math.round((researchUsed / researchLimit) * 100)) : 0;

  return (
    <div>
      <h1 className="text-h1 text-[var(--color-text)]">Dashboard</h1>
      <p className="mt-1 text-body-sm text-[var(--color-text-secondary)]">
        Welcome back, {session.user.email}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Prospects" value={String(totalProspects)} />
        <StatCard label="Researched" value={String(researchedProspects)} />
        <StatCard label="Messages This Month" value={String(messagesSent)} />
      </div>

      {usage && researchLimit > 0 && (
        <div className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <p className="text-label text-[var(--color-text-muted)]">Monthly Usage</p>
          <div className="mt-3 space-y-3">
            <UsageBar
              label="Prospect Research"
              used={researchUsed}
              limit={researchLimit}
              pct={researchPct}
            />
            {((usage.messages_generated_limit as number) ?? 0) > 0 && (
              <UsageBar
                label="Messages Generated"
                used={(usage.messages_generated_used as number) ?? 0}
                limit={(usage.messages_generated_limit as number) ?? 0}
                pct={Math.min(100, Math.round((((usage.messages_generated_used as number) ?? 0) / ((usage.messages_generated_limit as number) ?? 1)) * 100))}
              />
            )}
          </div>
        </div>
      )}

      {recentProspects.length > 0 && (
        <div className="mt-6">
          <h2 className="text-h2 text-[var(--color-text)]">Recent Activity</h2>
          <div className="mt-3 divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            {recentProspects.map((p) => {
              const prospect = toId(p);
              return (
                <a
                  key={prospect.id}
                  href={`/prospects/${prospect.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  <div>
                    <p className="text-body-sm font-medium text-[var(--color-text)]">{prospect.full_name as string}</p>
                    {prospect.company_name && (
                      <p className="text-label text-[var(--color-text-muted)]">{prospect.company_name as string}</p>
                    )}
                  </div>
                  <StatusBadge status={prospect.status as string} />
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <p className="text-label text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-2 text-display tabular-nums text-[var(--color-text)]">{value}</p>
    </div>
  );
}

function UsageBar({ label, used, limit, pct }: { label: string; used: number; limit: number; pct: number }) {
  const isNearLimit = pct >= 80;
  return (
    <div>
      <div className="flex justify-between text-body-sm text-[var(--color-text-secondary)] mb-1">
        <span>{label}</span>
        <span>{used} / {limit}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
        <div
          className={`h-full rounded-full transition-all ${isNearLimit ? 'bg-amber-500' : 'bg-[var(--color-primary)]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const statusColors: Record<string, string> = {
  new: 'bg-gray-100 text-gray-700',
  researched: 'bg-blue-100 text-blue-700',
  ready: 'bg-purple-100 text-purple-700',
  sent: 'bg-yellow-100 text-yellow-700',
  replied: 'bg-green-100 text-green-700',
  not_interested: 'bg-red-100 text-red-700',
  converted: 'bg-emerald-100 text-emerald-700',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusColors[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
