import { Router } from "express";
import { handleRenderJob } from "../renderHandler";
import { handleEchoTrainingJob } from "../echoTrainHandler";

/**
 * Not part of the public API surface — no x-api-key check. In production
 * this is reachable only via Cloud Tasks' OIDC-authenticated request (GCP
 * enforces that at the Cloud Run ingress level); locally, an optional
 * shared-secret header is enough since nothing but your own dev queue
 * calls it.
 */
export function internalRouter(rootDir: string): Router {
  const router = Router();

  router.post("/internal/render", async (req, res) => {
    const expectedSecret = process.env.INTERNAL_RENDER_SECRET;
    if (expectedSecret && req.header("x-internal-secret") !== expectedSecret) {
      res.status(401).json({ detail: "Missing or invalid internal secret." });
      return;
    }

    const jobId = req.body?.jobId;
    if (typeof jobId !== "string") {
      res.status(400).json({ detail: "Missing jobId." });
      return;
    }

    await handleRenderJob({ jobId }, rootDir);
    res.status(200).json({ detail: "Rendered." });
  });

  router.post("/internal/echo-train", async (req, res) => {
    const expectedSecret = process.env.INTERNAL_RENDER_SECRET;
    if (expectedSecret && req.header("x-internal-secret") !== expectedSecret) {
      res.status(401).json({ detail: "Missing or invalid internal secret." });
      return;
    }

    const echoModelId = req.body?.echoModelId;
    if (typeof echoModelId !== "string") {
      res.status(400).json({ detail: "Missing echoModelId." });
      return;
    }

    await handleEchoTrainingJob({ echoModelId });
    res.status(200).json({ detail: "Trained." });
  });

  return router;
}
