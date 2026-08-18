import path from "node:path";
import fs from "node:fs/promises";
import { getJob, updateJob } from "../storage/firestore";
import { renderSceneDocumentJob } from "../pipeline/renderJob";
import { renderAdJob } from "../pipeline/renderAdJob";
import type { RenderJobPayload } from "../queue/types";

/**
 * The actual render work, run asynchronously after `generate` has already
 * returned a job_id. Shared by DevQueue (in-process, local dev) and the
 * /internal/render endpoint (invoked by real Cloud Tasks in production) —
 * one implementation, two dispatch paths.
 */
export async function handleRenderJob(payload: RenderJobPayload, rootDir: string): Promise<void> {
  const job = await getJob(payload.jobId);
  if (!job) {
    console.error(`handleRenderJob: job ${payload.jobId} not found, skipping.`);
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    await updateJob(job.id, { status: "failed", statusMessage: "Server misconfiguration: ELEVENLABS_API_KEY not set." });
    return;
  }

  try {
    await updateJob(job.id, { status: "rendering" });

    const outputDir = path.join(rootDir, "output", "jobs");
    await fs.mkdir(outputDir, { recursive: true });
    const outputLocation = path.join(outputDir, `${job.id}.mp4`);

    const isAdJob = (job.request as { mode?: string }).mode === "ad";

    if (isAdJob) {
      const result = await renderAdJob({
        request: job.request,
        ownerApiKeyId: job.apiKeyId,
        apiKey,
        rootDir,
        outputLocation,
        uploadKey: `jobs/${job.id}.mp4`,
        audioFileName: `tts-ad-${job.id}.mp3`,
      });

      if (!result.uploadUrl) {
        throw new Error(result.uploadError ?? "R2 upload failed with no error message.");
      }

      await updateJob(job.id, { status: "ready", resultUrl: result.uploadUrl, cost: result.jobCost });
      return;
    }

    const result = await renderSceneDocumentJob({
      request: job.request as Parameters<typeof renderSceneDocumentJob>[0]["request"],
      apiKey,
      rootDir,
      outputLocation,
      uploadKey: `jobs/${job.id}.mp4`,
      audioFileName: `tts-audio-${job.id}.mp3`,
    });

    if (!result.uploadUrl) {
      throw new Error(result.uploadError ?? "R2 upload failed with no error message.");
    }

    await updateJob(job.id, {
      status: "ready",
      resultUrl: result.uploadUrl,
      cost: result.jobCost,
      statusMessage: result.timingWarnings.length > 0 ? result.timingWarnings.join(" | ") : undefined,
    });
  } catch (err) {
    await updateJob(job.id, { status: "failed", statusMessage: (err as Error).message });
  }
}
