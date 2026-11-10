import { redirect } from 'next/navigation';
import { getAuthSession } from '../../../lib/session';
import { subscriptions } from '../../../lib/mongodb/collections';
import { PlanCard } from '../../../components/billing/plan-card';

export const metadata = { title: 'Upgrade Plan — Flintel' };

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 9,
    prospects: 30,
    messages: 90,
    bulk: false,
    maxBatch: 0,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 19,
    prospects: 100,
    messages: 300,
    bulk: true,
    maxBatch: 50,
    recommended: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: 49,
    prospects: 300,
    messages: 900,
    bulk: true,
    maxBatch: 100,
  },
] as const;

export default async function PricingUpgradePage() {
  const session = await getAuthSession();
  if (!session) redirect('/login');

  const col = await subscriptions();
  const sub = await col.findOne(
    { user_id: session.user.id, status: 'active' },
    { projection: { plan_id: 1 } },
  );

  const currentPlanId = sub?.plan_id ?? null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Choose your plan</h1>
        <p className="mt-2 text-gray-600">
          Research prospects faster. All plans include the Chrome extension.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            {...plan}
            current={plan.id === currentPlanId}
          />
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-gray-400">
        Payments processed securely by Paddle. Cancel anytime.
      </p>
    </div>
  );
}
