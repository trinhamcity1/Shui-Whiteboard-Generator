import { Router } from "express";
import { ApiError } from "../errors";
import { getApiKeyById, getOrCreateAccount, listLedgerForOwner, cancelSubscription } from "../../storage/firestore";
import { getTierConfig } from "../../billing/tiers";

/**
 * Self-serve view of "your account" — the tier and credit wallet, same
 * ownerLabel identity keysRouter already uses. Upgrading a subscription
 * (moving to a HIGHER tier) requires real payment collection, so it only
 * happens via a real Stripe checkout webhook (still to be integrated —
 * see internal.ts's /internal/billing/* routes for where it plugs in) or,
 * for now, that same internal route called by hand for testing.
 * Cancelling never needs payment collection — it's the one tier change
 * this router can do directly, below.
 */
export function accountRouter(): Router {
  const router = Router();

  router.get("/account", async (req, res, next) => {
    try {
      const self = await getApiKeyById(req.apiKeyId!);
      if (!self) throw new ApiError(401, "Missing or invalid x-api-key header.");
      const account = await getOrCreateAccount(self.ownerLabel);
      const config = getTierConfig(account.tier);
      res.json({
        tier: account.tier,
        tierName: config.name,
        creditBalance: account.creditBalance,
        monthlyPriceUsd: config.monthlyPriceUsd,
        baseCreditsPerMinute: config.baseCreditsPerMinute,
        topicCreditsPerMinute: config.topicCreditsPerMinute,
        maxLengthMinutes: config.maxLengthMinutes,
        apiAccess: config.apiAccess,
        uiAccess: config.uiAccess,
        verticalOnly: config.verticalOnly,
        echoAccess: config.echoAccess,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/account/ledger", async (req, res, next) => {
    try {
      const self = await getApiKeyById(req.apiKeyId!);
      if (!self) throw new ApiError(401, "Missing or invalid x-api-key header.");
      const entries = await listLedgerForOwner(self.ownerLabel);
      res.json({ items: entries });
    } catch (err) {
      next(err);
    }
  });

  router.post("/account/cancel", async (req, res, next) => {
    try {
      const self = await getApiKeyById(req.apiKeyId!);
      if (!self) throw new ApiError(401, "Missing or invalid x-api-key header.");
      const account = await cancelSubscription(self.ownerLabel);
      const config = getTierConfig(account.tier);
      res.json({ tier: account.tier, tierName: config.name, creditBalance: account.creditBalance });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
