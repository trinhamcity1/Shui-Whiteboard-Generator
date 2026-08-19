import type { JobRecord } from "../storage/firestore";

/**
 * API responses use snake_case, matching the Golpo-shaped contract (job_id, etc).
 *
 * `canDownload` gates result_url server-side, not just in the web UI —
 * download requires the account's CURRENT tier to be Obsidian or above
 * (Siltstone is locked out, including its one free trial video, until it
 * upgrades). This is a live check re-evaluated on every request, not a
 * per-job flag: cancel back to Siltstone and previously-downloadable
 * videos lock again; upgrade and everything — old and new — unlocks.
 * Defaults to true so every existing internal caller (renderHandler.ts's
 * own bookkeeping, etc.) keeps seeing the real URL unless a route
 * explicitly computes and passes the gate.
 */
export function serializeJob(job: JobRecord, opts: { canDownload?: boolean } = {}) {
  const canDownload = opts.canDownload ?? true;
  return {
    id: job.id,
    status: job.status,
    status_message: job.statusMessage,
    title: job.title,
    result_url: canDownload ? job.resultUrl : undefined,
    download_locked: !canDownload && job.status === "ready",
    cost: job.cost,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  };
}
