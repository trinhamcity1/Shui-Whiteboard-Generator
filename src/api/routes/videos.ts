import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../errors";
import { serializeJob } from "../serializers";
import { resolveSceneDocument, type SceneDocumentRequest } from "../../pipeline/resolveSceneDocument";
import { createJob, getJob, listJobsForKey, updateJob, type JobRecord } from "../../storage/firestore";
import type { JobQueue } from "../../queue/types";

export function videosRouter(queue: JobQueue): Router {
  const router = Router();

  router.post("/videos/generate", async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      const hasScenes = "scenes" in body && body.scenes !== undefined;
      const hasScript = "narrationScript" in body && body.narrationScript !== undefined;

      if (hasScenes && hasScript) {
        throw new ApiError(400, "Request must supply either `scenes` or `narrationScript`, not both.");
      }
      if (!hasScenes && !hasScript) {
        throw new ApiError(400, "Request must supply either `scenes` (pre-authored) or `narrationScript` (script-only).");
      }

      let sceneDocument;
      try {
        sceneDocument = resolveSceneDocument(body as unknown as SceneDocumentRequest);
      } catch (err) {
        const message = (err as Error).message;
        if (message.includes("not implemented")) {
          throw new ApiError(400, "The `narrationScript`-only path is not available until Phase 3 — supply `scenes` instead.");
        }
        throw err;
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
