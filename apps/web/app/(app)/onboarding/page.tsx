'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Step = 'describe' | 'review';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('describe');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [extractedCount, setExtractedCount] = useState(0);
  const [error, setError] = useState('');

  async function handleExtract() {
    if (!description.trim()) {
      setError('Please describe your business first');
      return;
    }
    setError('');
    setLoading(true);

    const res = await fetch('/api/brain/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: description, source_type: 'manual_input' }),
    });

    if (!res.ok) {
      setError('Failed to process. Please try again.');
      setLoading(false);
      return;
    }

    const data = await res.json() as { extracted_count: number };
    setExtractedCount(data.extracted_count);
    setStep('review');
    setLoading(false);
  }

  async function finish() {
    router.push('/brain');
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
      <div className="w-full max-w-lg px-4">
        <div className="text-center mb-8">
          <span className="font-display text-3xl text-[var(--color-text)]">Flintel</span>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Dot active={step === 'describe'} />
            <Dot active={step === 'review'} />
          </div>
        </div>

        {step === 'describe' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-h2 text-[var(--color-text)]">Tell us about your business</h2>
              <p className="mt-1 text-body-sm text-[var(--color-text-secondary)]">
                Describe what you sell, who you sell to, and what problems you solve.
                The more detail you give, the more personalized your outreach will be.
              </p>
            </div>

            <Textarea
              rows={8}
              placeholder={`Example: We build AI-powered inventory management software for mid-market retailers (50–500 employees). Our main buyers are Operations Directors and VP of Supply Chain at specialty retail chains. We solve stockout and overstock problems — typically saving 15–20% on carrying costs. Our differentiator is real-time POS integration with same-day alerts. We're in the US and Canada.`}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button
              onClick={() => void handleExtract()}
              disabled={loading || !description.trim()}
              className="w-full"
            >
              {loading ? 'Extracting facts…' : 'Continue'}
            </Button>

            <p className="text-xs text-center text-[var(--color-text-muted)]">
              You can always add more details later in Business Brain settings.
            </p>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-h2 text-[var(--color-text)]">Business Brain created</h2>
              <p className="mt-1 text-body-sm text-[var(--color-text-secondary)]">
                We extracted {extractedCount} facts from your description. You can review and edit them in the Business Brain page.
              </p>
            </div>

            <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-4 text-sm text-green-700 dark:text-green-400">
              Your Business Brain is ready. Research will now be personalized to your ICP and value proposition.
            </div>

            <Button onClick={() => void finish()} className="w-full">
              Go to dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Dot({ active }: { active: boolean }) {
  return (
    <div className={`h-2 w-2 rounded-full transition-colors ${active ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`} />
  );
}
