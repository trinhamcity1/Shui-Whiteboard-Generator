import path from "node:path";
import fs from "node:fs/promises";
import { getApiKeyById, debitAccount, getOrCreateAccount, markFreeTrialUsed, getJob, updateJob } from "../storage/firestore";
import { renderSceneDocumentJob } from "../pipeline/renderJob";
import { renderAdJob } from "../pipeline/renderAdJob";
import { creditsPerMinuteFor, resolveBillingMode } from "../billing/gate";
import { InsufficientCreditsError } from "../billing/types";
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

    // generateQuiz/quizMaxQuestions ride along on the same request body as
    // everything else (job.request is the raw POST body, stored wholesale)
    // rather than being SceneDocumentRequest fields — they're render-job
    // options, not part of the scene-document shape itself.
    const quizOptions = job.request as { generateQuiz?: unknown; quizMaxQuestions?: unknown };
    const result = await renderSceneDocumentJob({
      request: job.request as Parameters<typeof renderSceneDocumentJob>[0]["request"],
      apiKey,
      rootDir,
      outputLocation,
      uploadKey: `jobs/${job.id}.mp4`,
      audioFileName: `tts-audio-${job.id}.mp3`,
      generateQuiz: quizOptions.generateQuiz === true,
      quizMaxQuestions: typeof quizOptions.quizMaxQuestions === "number" ? quizOptions.quizMaxQuestions : undefined,
    });

    if (!result.uploadUrl) {
      throw new Error(result.uploadError ?? "R2 upload failed with no error message.");
    }

    // Billing always happens against the REAL rendered duration, never a
    // pre-render estimate (the `generate` route's estimate is only a fast
    // upper-bound pre-check — see billing/gate.ts's own comment). This
    // debit runs after the video already exists and uploaded successfully
    // — a failure here (e.g. the balance shifted since the pre-check, a
    // race against a concurrent job) must NOT undo or fail delivery of a
    // video that's already been rendered; it's logged onto the job instead
    // so it's visible, not silently lost.
    let billingWarning: string | undefined;
    let freeTrialUsed = false;
    try {
      const self = await getApiKeyById(job.apiKeyId);
      if (self) {
        const account = await getOrCreateAccount(self.ownerLabel);
        if (account.hasUsedFreeTrial) {
          const mode = resolveBillingMode(job.request as { topic?: unknown });
          const creditsPerMinute = creditsPerMinuteFor(account.tier, mode);
          const minutes = result.videoDurationSeconds / 60;
          await debitAccount(self.ownerLabel, minutes * creditsPerMinute, `video:${job.id}`);
        } else {
          // The account's one free trial video — waived, not debited.
          // Marked used only now, on real success, so a render that
          // fails never burns the customer's one free shot.
          await markFreeTrialUsed(self.ownerLabel);
          freeTrialUsed = true;
        }
      }
    } catch (err) {
      billingWarning =
        err instanceof InsufficientCreditsError
          ? `Billing warning: could not charge for this video — insufficient balance (${err.message}). The video was still delivered; this account is undercharged.`
          : `Billing warning: failed to charge for this video: ${(err as Error).message}`;
      console.error(`handleRenderJob: billing failed for job ${job.id}:`, err);
    }

    const combinedStatusMessage = [
      result.timingWarnings.length > 0 ? result.timingWarnings.join(" | ") : undefined,
      freeTrialUsed ? "Free trial video — not charged." : undefined,
      billingWarning,
    ]
      .filter(Boolean)
      .join(" | ");

    await updateJob(job.id, {
      status: "ready",
      resultUrl: result.uploadUrl,
      cost: result.jobCost,
      quiz: result.quiz,
      statusMessage: combinedStatusMessage || undefined,
    });
  } catch (err) {
    await updateJob(job.id, { status: "failed", statusMessage: (err as Error).message });
  }
}
