import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../errors";
import { serializeJob } from "../serializers";
import { ScriptOnlyRequestSchema, TopicRequestSchema, type SceneDocumentRequest } from "../../pipeline/resolveSceneDocument";
import { parseSceneDocument } from "../../schema/scene";
import { AdRequestSchema } from "../../schema/ad";
import { createJob, getJob, listJobsForKey, updateJob, type JobRecord } from "../../storage/firestore";
import type { JobQueue } from "../../queue/types";

export function videosRouter(queue: JobQueue): Router {
  const router = Router();

  router.post("/videos/generate", async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      const isAdRequest = body.mode === "ad";

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
        if (hasScenes) {
          parseSceneDocument(body.scenes); // throws SceneValidationError -> 422 via errorHandler
        } else {
          const schema = hasTopic ? TopicRequestSchema : ScriptOnlyRequestSchema;
          const result = schema.safeParse(body);
          if (!result.success) {
            throw new ApiError(
              422,
              result.error.issues.map((issue) => ({ loc: issue.path, msg: issue.message })),
            );
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
      res.json({ items: jobs.map(serializeJob), limit, offset });
    } catch (err) {
      next(err);
    }
  });

  router.get("/videos/:id", async (req, res, next) => {
    try {
      const job = await getJob(req.params.id);
      if (!job) throw new ApiError(404, "Job not found.");
      if (job.apiKeyId !== req.apiKeyId) throw new ApiError(403, "Not permitted.");
      res.json(serializeJob(job));
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
