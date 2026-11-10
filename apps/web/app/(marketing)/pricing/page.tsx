import Link from 'next/link';

export const metadata = {
  title: 'Pricing — Flintel',
  description: 'Simple, transparent pricing. Start free and upgrade as you grow.',
};

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 9,
    prospects: 30,
    messages: 90,
    bulk: false,
    recommended: false,
    features: [
      '30 prospect reports/month',
      '90 AI messages/month',
      'Business Brain',
      'Chrome extension',
      'CRM & follow-ups',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 19,
    prospects: 100,
    messages: 300,
    bulk: true,
    recommended: true,
    features: [
      '100 prospect reports/month',
      '300 AI messages/month',
      'Business Brain',
      'Chrome extension',
      'CRM & follow-ups',
      'Bulk upload (up to 50 URLs)',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: 49,
    prospects: 300,
    messages: 900,
    bulk: true,
    recommended: false,
    features: [
      '300 prospect reports/month',
      '900 AI messages/month',
      'Business Brain',
      'Chrome extension',
      'CRM & follow-ups',
      'Bulk upload (up to 100 URLs)',
      'Priority support',
    ],
  },
] as const;

export default function PricingPage() {
  return (
    <div className="px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">Simple pricing</h1>
          <p className="text-lg text-gray-600">
            One flat monthly fee. No per-seat pricing. Cancel anytime.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                plan.recommended
                  ? 'border-blue-500 shadow-lg shadow-blue-100'
                  : 'border-gray-200'
              } bg-white`}
            >
              {plan.recommended && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white">
                  Most popular
                </span>
              )}

              <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900">{plan.name}</h2>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                  <span className="text-gray-500">/mo</span>
                </div>
              </div>

              <ul className="mb-8 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="h-4 w-4 flex-shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className={`w-full rounded-lg px-5 py-2.5 text-center text-sm font-semibold transition ${
                  plan.recommended
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-600">
          <p>
            All plans are paid monthly. Annual billing available at 20% discount.
            Payments processed by <strong>Paddle</strong> — your Merchant of Record.
          </p>
        </div>

        {/* FAQ */}
        <div className="mt-16">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">Frequently asked</h2>
          <div className="space-y-6">
            {[
              {
                q: 'What counts as a credit?',
                a: 'Each prospect research report costs 1 credit, regardless of how the research is triggered — single, bulk, or via the Chrome extension.',
              },
              {
                q: 'What happens if I hit my limit?',
                a: 'Research is paused for the rest of the billing period. You can upgrade at any time to unlock more credits immediately.',
              },
              {
                q: 'Is there a free trial?',
                a: 'You can subscribe to any plan and cancel any time within the first 7 days for a full refund if Flintel isn\'t the right fit.',
              },
              {
                q: 'What data sources do you use?',
                a: 'We combine People Data Labs (B2B professional data), Serper (web research), and Claude AI for synthesis. All data providers are GDPR-compliant.',
              },
            ].map((item) => (
              <div key={item.q} className="border-b border-gray-200 pb-6">
                <h3 className="mb-2 font-semibold text-gray-900">{item.q}</h3>
                <p className="text-gray-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
