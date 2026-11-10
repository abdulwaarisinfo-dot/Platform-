import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ObjectId } from 'mongodb';
import { getAuthSession } from '../../../../../lib/session';
import { batchJobs, batchUrls } from '../../../../../lib/mongodb/collections';
import { BatchProgress } from '../../../../../components/bulk/batch-progress';

export const metadata = { title: 'Batch Job — Flintel' };

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const session = await getAuthSession();
  if (!session) redirect('/login');

  let jobOid: ObjectId;
  try {
    jobOid = new ObjectId(batchId);
  } catch {
    notFound();
  }

  const [job, urls] = await Promise.all([
    (await batchJobs()).findOne({ _id: jobOid, user_id: session.user.id }),
    (await batchUrls())
      .find({ batch_job_id: batchId })
      .sort({ created_at: 1 })
      .toArray(),
  ]);

  if (!job) notFound();

  const jobData = {
    id: job._id.toString(),
    name: job.name ?? null,
    status: job.status,
    total_urls: job.total_urls ?? 0,
    completed_urls: job.completed_urls ?? 0,
    failed_count: job.failed_count ?? 0,
    skipped_count: job.skipped_count ?? 0,
    created_at: job.created_at,
    completed_at: job.completed_at ?? null,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/prospects/bulk" className="text-sm text-gray-500 hover:text-gray-700">
          ← All batches
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold text-gray-900">{job.name}</h1>

      <div className="mb-8">
        <BatchProgress job={jobData} />
      </div>

      {['pending', 'running'].includes(job.status) && (
        <div className="mb-6 flex justify-end">
          <form
            action={`/api/prospects/bulk/${batchId}/cancel`}
            method="POST"
          >
            <button
              type="submit"
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Cancel Batch
            </button>
          </form>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">URLs ({urls.length})</h2>
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {urls.map((u) => (
            <div key={u._id.toString()} className="flex items-center gap-3 px-4 py-3">
              <span
                className={`flex-shrink-0 text-sm font-medium ${
                  u.status === 'completed'
                    ? 'text-green-600'
                    : u.status === 'failed'
                      ? 'text-red-500'
                      : u.status === 'skipped'
                        ? 'text-gray-400'
                        : 'text-yellow-600'
                }`}
              >
                {u.status === 'completed' ? '✓' : u.status === 'failed' ? '✗' : u.status === 'skipped' ? '–' : '…'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-gray-700">{u.url}</p>
                {u.error_message && (
                  <p className="text-xs text-red-500">{u.error_message}</p>
                )}
              </div>
              {u.prospect_id && (
                <Link
                  href={`/prospects/${u.prospect_id}`}
                  className="flex-shrink-0 text-xs font-medium text-blue-600 hover:underline"
                >
                  View
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
