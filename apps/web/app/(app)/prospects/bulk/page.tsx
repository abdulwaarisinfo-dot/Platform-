import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthSession } from '../../../../lib/session';
import { subscriptions, batchJobs } from '../../../../lib/mongodb/collections';
import { BulkUploadForm } from '../../../../components/bulk/bulk-upload-form';

export const metadata = { title: 'Bulk Upload — Flintel' };

export default async function BulkUploadPage() {
  const session = await getAuthSession();
  if (!session) redirect('/login');

  const userId = session.user.id;

  const sub = await (await subscriptions()).findOne(
    { user_id: userId, status: 'active' },
    { projection: { plan_id: 1 } },
  );

  const planId = sub?.plan_id ?? 'starter';

  if (planId === 'starter') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Bulk Upload</h1>
        <p className="mb-6 text-gray-600">
          Bulk upload is available on Pro and Business plans. Upgrade to research
          up to 50–100 LinkedIn profiles at once.
        </p>
        <Link
          href="/pricing-upgrade"
          className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Upgrade Plan
        </Link>
      </div>
    );
  }

  const jobs = await (await batchJobs())
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .limit(5)
    .toArray();

  const maxUrls = planId === 'business' ? 100 : 50;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Bulk Upload</h1>
        <p className="mt-1 text-gray-600">
          Paste up to {maxUrls} LinkedIn profile URLs — one per line.
        </p>
      </div>

      <BulkUploadForm maxUrls={maxUrls} />

      {jobs.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent Batches</h2>
          <div className="space-y-3">
            {jobs.map((job) => (
              <Link
                key={job._id.toString()}
                href={`/prospects/bulk/${job._id.toString()}`}
                className="block rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:bg-blue-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{job.name}</p>
                    <p className="text-sm text-gray-500">
                      {job.completed_urls ?? 0}/{job.total_urls ?? 0} completed
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      job.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : job.status === 'running'
                          ? 'bg-blue-100 text-blue-700'
                          : job.status === 'cancelled'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {job.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
