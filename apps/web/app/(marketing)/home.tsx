import Link from "next/link";

export function MarketingHome() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-white to-gray-50 px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <span className="mb-4 inline-block rounded-full bg-[var(--color-accent-subtle)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-accent-text)]">
            AI-powered prospect research
          </span>
          <h1 className="mb-6 text-5xl font-extrabold leading-tight tracking-tight text-[var(--color-text)] sm:text-6xl">
            Know your prospect before the first message
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-[var(--color-text-secondary)]">
            Paste a LinkedIn URL. Get a full intelligence report — role signals, company context,
            opportunity score, and a personalised outreach message — in under 10 seconds.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="rounded-xl bg-[var(--color-accent)] px-7 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-[var(--color-accent-hover)]"
            >
              Start for $9 / month
            </Link>
            <Link
              href="/pricing"
              className="rounded-xl border border-[var(--color-border-strong)] px-7 py-3.5 text-base font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-[var(--color-text)]">
            Three steps. Ten seconds.
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Paste a LinkedIn URL",
                body: "Or use the Chrome extension — one click when you are on any LinkedIn profile.",
              },
              {
                step: "2",
                title: "AI builds the report",
                body: "We enrich from People Data Labs, run web research, and synthesise everything through your Business Brain.",
              },
              {
                step: "3",
                title: "Send the perfect message",
                body: "Get LinkedIn DMs, cold emails, and follow-ups tailored to this prospect and your unique value proposition.",
              },
            ].map((item) => (
              <div key={item.step} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent-subtle)] text-sm font-bold text-[var(--color-accent-text)]">
                  {item.step}
                </div>
                <h3 className="mb-2 font-semibold text-[var(--color-text)]">{item.title}</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-[var(--color-text)]">Ready to research smarter?</h2>
          <p className="mb-8 text-[var(--color-text-secondary)]">
            Start free. No credit card required. Starter plan from $9/month.
          </p>
          <Link
            href="/register"
            className="rounded-xl bg-[var(--color-accent)] px-8 py-4 text-base font-semibold text-white shadow-lg hover:bg-[var(--color-accent-hover)]"
          >
            Get started free
          </Link>
        </div>
      </section>
    </>
  );
}
