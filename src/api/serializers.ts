import type { JobRecord } from "../storage/firestore";

/** API responses use snake_case, matching the Golpo-shaped contract (job_id, etc). */
export function serializeJob(job: JobRecord) {
  return {
    id: job.id,
    status: job.status,
    status_message: job.statusMessage,
    title: job.title,
    result_url: job.resultUrl,
    cost: job.cost,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  };
}
