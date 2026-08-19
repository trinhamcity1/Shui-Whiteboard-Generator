import { Router } from "express";
import { TIER_CONFIGS, ECHO_TRAIN_CREDITS, ECHO_RETRAIN_CREDITS } from "../../billing/tiers";

/**
 * Public, unauthenticated — the pricing page (and the landing page's
 * pricing preview) reads real tier data from here instead of duplicating
 * billing/tiers.ts's numbers in the web app and letting the two drift.
 */
export function pricingRouter(): Router {
  const router = Router();

  router.get("/pricing", (_req, res) => {
    res.json({
      tiers: Object.values(TIER_CONFIGS),
      echo: { trainCredits: ECHO_TRAIN_CREDITS, retrainCredits: ECHO_RETRAIN_CREDITS },
    });
  });

  return router;
}
