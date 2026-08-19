import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../errors";
import { serializeJob } from "../serializers";
import { ScriptOnlyRequestSchema, TopicRequestSchema, type SceneDocumentRequest } from "../../pipeline/resolveSceneDocument";
import { parseSceneDocument } from "../../schema/scene";
import { AdRequestSchema } from "../../schema/ad";
import { createJob, getJob, getApiKeyById, getOrCreateAccount, listJobsForKey, updateJob, type JobRecord } from "../../storage/firestore";
import {
  assertApiAccess,
  assertEchoAccess,
  assertLengthAllowed,
  assertOrientationAllowed,
  creditsPerMinuteFor,
  estimateRequestMinutes,
  resolveBillingMode,
} from "../../billing/gate";
import { InsufficientCreditsError } from "../../billing/types";
import type { JobQueue } from "../../queue/types";

/** Download requires the CALLING KEY's account to currently be on a paid
 * (non-Siltstone) tier — see serializeJob's own comment on why this is a
 * live check, not a per-job flag. */
async function accountAllowsDownload(apiKeyId: string): Promise<boolean> {
  const self = await getApiKeyById(apiKeyId);
  if (!self) return false;
  const account = await getOrCreateAccount(self.ownerLabel);
  return account.tier !== "siltstone";
}

export function videosRouter(queue: JobQueue): Router {
  const router = Router();

  router.post("/videos/generate", async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      const isAdRequest = body.mode === "ad";

      const self = await getApiKeyById(req.apiKeyId!);
      if (!self) throw new ApiError(401, "Missing or invalid x-api-key header.");
      const account = await getOrCreateAccount(self.ownerLabel);
      assertApiAccess(account.tier);

      if (isAdRequest) {
        // Ads have only one path (the planner always runs — there's no
        // pre-authored-beats equivalent yet), so this is the full
        // synchronous shape check; the real AdDocument only exists after
        // the async planning call in the render worker.
        const result = AdRequestSchema.safeParse(body);
        if (!result.success) {
          throw new ApiError(
            422,
            result.error.issues.map((issue) => ({ loc: issue.path, msg: issue.message })),
          );
        }
      } else {
        const hasScenes = "scenes" in body && body.scenes !== undefined;
        const hasScript = "narrationScript" in body && body.narrationScript !== undefined;
        const hasTopic = "topic" in body && body.topic !== undefined;

        const modesSupplied = [hasScenes, hasScript, hasTopic].filter(Boolean).length;
        if (modesSupplied > 1) {
          throw new ApiError(400, "Request must supply exactly one of `scenes`, `narrationScript`, or `topic`, not more than one.");
        }
        if (modesSupplied === 0) {
          throw new ApiError(
            400,
            "Request must supply one of `scenes` (pre-authored), `narrationScript` (script-only), or `topic` (topic-only).",
          );
        }

        // Only the pre-authored path is validated synchronously here — it's
        // cheap and deterministic, so an immediate 422 is the right feedback.
        // The narrationScript-only and topic-only paths get a light shape
        // check (real validation happens after their LLM call(s), in the
        // async render worker) so `generate` never blocks on — or
        // double-pays for — a network call to the script writer or planner.
        let narrationScriptForEstimate: string | undefined;
        if (hasScenes) {
          const parsed = parseSceneDocument(body.scenes); // throws SceneValidationError -> 422 via errorHandler
          narrationScriptForEstimate = parsed.narrationScript;
        } else {
          const schema = hasTopic ? TopicRequestSchema : ScriptOnlyRequestSchema;
          const result = schema.safeParse(body);
          if (!result.success) {
            throw new ApiError(
              422,
              result.error.issues.map((issue) => ({ loc: issue.path, msg: issue.message })),
            );
          }
          narrationScriptForEstimate = hasScript ? (result.data as { narrationScript: string }).narrationScript : undefined;
        }

        // Tier gating — feature access and rough length/afford checks, all
        // before any real work (LLM calls, image generation, render) has
        // started. The real charge always comes from the actual rendered
        // duration afterward (renderHandler.ts) — this is a fast, cheap
        // upper-bound check, not the final bill.
        const mode = resolveBillingMode(body);
        const creditsPerMinute = creditsPerMinuteFor(account.tier, mode); // throws 403 if this tier can't use topic mode
        assertOrientationAllowed(account.tier, body.orientation as "vertical" | "horizontal" | undefined);
        if (typeof body.echoModelId === "string") assertEchoAccess(account.tier);

        const estimatedMinutes = estimateRequestMinutes({
          mode,
          narrationScript: narrationScriptForEstimate,
          targetDurationSeconds: typeof body.targetDurationSeconds === "number" ? body.targetDurationSeconds : undefined,
        });
        if (estimatedMinutes > 0) {
          assertLengthAllowed(account.tier, estimatedMinutes);
          // The account's one free trial video skips the balance check
          // entirely — feature gates above (tier access, topic mode,
          // orientation, max length) still apply as normal; only the
          // credit requirement is waived. renderHandler.ts makes the
          // matching call on the billing side after the render succeeds.
          if (account.hasUsedFreeTrial) {
            const estimatedCost = estimatedMinutes * creditsPerMinute;
            if (account.creditBalance < estimatedCost) {
              throw new InsufficientCreditsError(account.ownerLabel, estimatedCost, account.creditBalance);
            }
          }
        }
      }

      const jobId = crypto.randomUUID();
      const job: Omit<JobRecord, "createdAt" | "updatedAt"> = {
        id: jobId,
        apiKeyId: req.apiKeyId!,
        status: "queued",
        request: body as unknown as SceneDocumentRequest,
        deletedAt: null,
      };
      await createJob(job);
      await queue.enqueueRenderJob({ jobId });

      res.status(202).json({ job_id: jobId, status: "queued" });
    } catch (err) {
      next(err);
    }
  });

  router.get("/videos", async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit ?? 20) || 20, 100);
      const offset = Number(req.query.offset ?? 0) || 0;
      const jobs = await listJobsForKey(req.apiKeyId!, limit, offset);
      const canDownload = await accountAllowsDownload(req.apiKeyId!);
      res.json({ items: jobs.map((job) => serializeJob(job, { canDownload })), limit, offset });
    } catch (err) {
      next(err);
    }
  });

  router.get("/videos/:id", async (req, res, next) => {
    try {
      const job = await getJob(req.params.id);
      if (!job) throw new ApiError(404, "Job not found.");
      if (job.apiKeyId !== req.apiKeyId) throw new ApiError(403, "Not permitted.");
      const canDownload = await accountAllowsDownload(req.apiKeyId!);
      res.json(serializeJob(job, { canDownload }));
    } catch (err) {
      next(err);
    }
  });

  const PatchBody = z.object({ title: z.string().min(1) }).strict();

  router.patch("/videos/:id", async (req, res, next) => {
    try {
      const job = await getJob(req.params.id);
      if (!job) throw new ApiError(404, "Job not found.");
      if (job.apiKeyId !== req.apiKeyId) throw new ApiError(403, "Not permitted.");

      const result = PatchBody.safeParse(req.body);
      if (!result.success) {
        throw new ApiError(
          422,
          result.error.issues.map((issue) => ({ loc: issue.path, msg: issue.message })),
        );
      }

      await updateJob(job.id, { title: result.data.title });
      const updated = await getJob(job.id);
      res.json(serializeJob(updated!));
    } catch (err) {
      next(err);
    }
  });

  router.delete("/videos/:id", async (req, res, next) => {
    try {
      const job = await getJob(req.params.id);
      if (!job) throw new ApiError(404, "Job not found.");
      if (job.apiKeyId !== req.apiKeyId) throw new ApiError(403, "Not permitted.");

      await updateJob(job.id, { deletedAt: Date.now() });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
