"use client";

import { useEffect, useState } from "react";
import { fetchJobs, deleteJob, type JobSummary } from "@/lib/api";

const STATUS_LABEL: Record<JobSummary["status"], string> = {
  queued: "Queued",
  rendering: "Rendering…",
  ready: "Ready",
  failed: "Failed",
};

const STATUS_CLASS: Record<JobSummary["status"], string> = {
  queued: "bg-paper text-ink-soft",
  rendering: "bg-accent-soft text-ink",
  ready: "bg-ink text-paper",
  failed: "bg-accent text-accent-ink",
};

/**
 * Every video an account has ever generated, regardless of plan — a
 * Siltstone account still gets to see and manage its run history, it just
 * can't download from here until it's on a paid plan (download_locked,
 * enforced server-side by the API, not just this UI — see serializeJob's
 * own comment on why that check lives there instead of just here).
 */
export function Library({ apiKey, refreshKey }: { apiKey: string; refreshKey: number }) {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { items } = await fetchJobs(apiKey);
        if (!cancelled) setJobs(items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    // Polls while anything is still in flight — cheap, and jobs render in
    // seconds to a couple of minutes, not something worth a websocket for.
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this video? This can't be undone.")) return;
    setDeletingId(id);
    try {
      await deleteJob(apiKey, id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-paper-raised p-6">
      <h2 className="font-display text-lg font-semibold text-ink">Library</h2>

      <div className="mt-4 divide-y divide-line">
        {loading ? (
          <p className="py-3 text-sm text-ink-faint">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="py-3 text-sm text-ink-faint">No videos yet.</p>
        ) : (
          jobs.map((job) => (
            <div key={job.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{job.title ?? job.id}</p>
                <p className="text-xs text-ink-faint">
                  {new Date(job.created_at).toLocaleString()}
                  {job.cost && ` · $${job.cost.totalCostUsd.toFixed(3)} real cost`}
                </p>
                {job.status_message && <p className="mt-1 text-xs text-ink-faint">{job.status_message}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASS[job.status]}`}>
                  {STATUS_LABEL[job.status]}
                </span>
                {job.result_url && (
                  <a
                    href={job.result_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-ink underline underline-offset-4"
                  >
                    Download
                  </a>
                )}
                {job.download_locked && (
                  <span
                    title="Downloading requires Obsidian or above — upgrade your plan to unlock this video."
                    className="text-xs font-semibold text-ink-faint"
                  >
                    🔒 Download locked
                  </span>
                )}
                <button
                  onClick={() => handleDelete(job.id)}
                  disabled={deletingId === job.id}
                  className="text-xs font-semibold text-accent hover:underline disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
