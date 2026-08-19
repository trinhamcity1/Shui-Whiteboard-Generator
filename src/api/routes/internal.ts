import { Router } from "express";
import { handleRenderJob } from "../renderHandler";
import { handleEchoTrainingJob } from "../echoTrainHandler";
import { creditAccount, setAccountTier } from "../../storage/firestore";
import { TIER_CONFIGS, type TierId } from "../../billing/tiers";

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

  // Where a real Stripe integration plugs in: a checkout/subscription
  // webhook would call these two instead of a human hitting them by hand.
  // Deliberately gated by a SEPARATE secret from render/echo-train's
  // (INTERNAL_BILLING_SECRET, not INTERNAL_RENDER_SECRET) — a leaked render
  // secret only lets someone trigger renders; a leaked billing secret lets
  // someone grant themselves free credits or a free tier upgrade, a much
  // worse blast radius. Unlike the optional secret above, this one is
  // REQUIRED to be configured — these routes 501 rather than running wide
  // open if INTERNAL_BILLING_SECRET isn't set, since "unauthenticated by
  // default" is the wrong failure mode for anything that moves money.
  router.post("/internal/billing/credit", async (req, res) => {
    const expectedSecret = process.env.INTERNAL_BILLING_SECRET;
    if (!expectedSecret) {
      res.status(501).json({ detail: "INTERNAL_BILLING_SECRET is not configured." });
      return;
    }
    if (req.header("x-internal-secret") !== expectedSecret) {
      res.status(401).json({ detail: "Missing or invalid internal secret." });
      return;
    }

    const { ownerLabel, amount, reason } = req.body ?? {};
    if (typeof ownerLabel !== "string" || typeof amount !== "number" || typeof reason !== "string") {
      res.status(400).json({ detail: "Expected { ownerLabel: string, amount: number, reason: string }." });
      return;
    }

    const account = await creditAccount(ownerLabel, amount, reason);
    res.status(200).json({ ownerLabel: account.ownerLabel, creditBalance: account.creditBalance });
  });

  router.post("/internal/billing/set-tier", async (req, res) => {
    const expectedSecret = process.env.INTERNAL_BILLING_SECRET;
    if (!expectedSecret) {
      res.status(501).json({ detail: "INTERNAL_BILLING_SECRET is not configured." });
      return;
    }
    if (req.header("x-internal-secret") !== expectedSecret) {
      res.status(401).json({ detail: "Missing or invalid internal secret." });
      return;
    }

    const { ownerLabel, tier } = req.body ?? {};
    if (typeof ownerLabel !== "string" || typeof tier !== "string" || !(tier in TIER_CONFIGS)) {
      res.status(400).json({ detail: `Expected { ownerLabel: string, tier: one of ${Object.keys(TIER_CONFIGS).join(", ")} }.` });
      return;
    }

    const account = await setAccountTier(ownerLabel, tier as TierId);
    res.status(200).json({ ownerLabel: account.ownerLabel, tier: account.tier });
  });

  return router;
}
