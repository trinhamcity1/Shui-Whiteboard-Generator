"use client";

import { useEffect, useState } from "react";
import { fetchJobs, type JobSummary } from "@/lib/api";

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

export function JobsList({ apiKey, refreshKey }: { apiKey: string; refreshKey: number }) {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="rounded-2xl border border-line bg-paper-raised p-6">
      <h2 className="font-display text-lg font-semibold text-ink">Your videos</h2>

      <div className="mt-4 divide-y divide-line">
        {loading ? (
          <p className="py-3 text-sm text-ink-faint">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="py-3 text-sm text-ink-faint">No videos yet — generate one above.</p>
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
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
