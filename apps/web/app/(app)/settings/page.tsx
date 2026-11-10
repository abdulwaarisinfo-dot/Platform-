import { redirect } from 'next/navigation';
import { getAuthSession } from '../../../lib/session';
import { subscriptions, usageRecords, users } from '../../../lib/mongodb/collections';

export const metadata = { title: 'Settings — Flintel' };

export default async function SettingsPage() {
  const session = await getAuthSession();
  if (!session) redirect('/login');

  const userId = session.user.id;

  const [userDoc, sub, usage] = await Promise.all([
    (await users()).findOne(
      { _id: userId as unknown as import('mongodb').ObjectId },
      { projection: { name: 1, email: 1 } },
    ),
    (await subscriptions()).findOne(
      { user_id: userId },
      { projection: { plan_id: 1, status: 1, current_period_end: 1 } },
      // sort by most recent — findOne with sort
    ),
    (await usageRecords()).findOne(
      { user_id: userId },
      { projection: { prospect_research_used: 1, prospect_research_limit: 1, messages_generated_used: 1, messages_generated_limit: 1 } },
    ),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold text-gray-900">Settings</h1>

      {/* Account */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Account</h2>
        <dl className="space-y-3">
          <div className="flex justify-between text-sm">
            <dt className="text-gray-500">Email</dt>
            <dd className="font-medium text-gray-900">{session.user.email}</dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-gray-500">Name</dt>
            <dd className="font-medium text-gray-900">{userDoc?.name ?? session.user.name ?? '—'}</dd>
          </div>
        </dl>
        <div className="mt-4 border-t border-gray-100 pt-4">
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="text-sm font-medium text-red-600 hover:text-red-700"
            >
              Sign out
            </button>
          </form>
        </div>
      </section>

      {/* Plan & Usage */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Plan &amp; Usage</h2>
          {sub?.plan_id && (
            <span className="rounded-full bg-blue-100 px-3 py-0.5 text-sm font-medium capitalize text-blue-700">
              {sub.plan_id}
            </span>
          )}
        </div>

        {usage && (
          <div className="space-y-4">
            <UsageBar
              label="Prospect research"
              used={usage.prospect_research_used ?? 0}
              limit={usage.prospect_research_limit ?? 0}
            />
            <UsageBar
              label="Messages generated"
              used={usage.messages_generated_used ?? 0}
              limit={usage.messages_generated_limit ?? 0}
            />
          </div>
        )}

        {sub?.current_period_end && (
          <p className="mt-4 text-xs text-gray-400">
            Resets {new Date(sub.current_period_end).toLocaleDateString()}
          </p>
        )}

        {!sub || sub.status !== 'active' ? (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <a
              href="/pricing-upgrade"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Upgrade plan →
            </a>
          </div>
        ) : null}
      </section>

      {/* Danger zone */}
      <section className="rounded-lg border border-red-200 bg-white p-6">
        <h2 className="mb-2 text-lg font-semibold text-red-700">Danger Zone</h2>
        <p className="mb-4 text-sm text-gray-500">
          Permanently delete your account and all data. This cannot be undone.
        </p>
        <button
          disabled
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 opacity-50"
          title="Contact support to delete your account"
        >
          Delete Account
        </button>
        <p className="mt-2 text-xs text-gray-400">Contact support to request account deletion.</p>
      </section>
    </div>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">
          {used} / {limit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
