import crypto from "node:crypto";
import { Router } from "express";
import { ApiError } from "../errors";
import { createApiKey, getApiKeyById, listApiKeysForOwner, setApiKeyActive } from "../../storage/firestore";

function serializeKey(k: { id: string; keyPreview: string; createdAt: number; isActive: boolean }) {
  return { id: k.id, keyPreview: `...${k.keyPreview}`, createdAt: k.createdAt, isActive: k.isActive };
}

/**
 * Self-serve key management for an already-authenticated caller — "your
 * account" is just "whichever api keys share your signup email"
 * (ownerLabel), the same minimal model /signup establishes. Mounted
 * under the existing requireApiKey + rateLimit chain in server.ts, same
 * as /videos and /assets.
 */
export function keysRouter(): Router {
  const router = Router();

  router.get("/keys", async (req, res, next) => {
    try {
      const self = await getApiKeyById(req.apiKeyId!);
      if (!self) throw new ApiError(401, "Missing or invalid x-api-key header.");
      const keys = await listApiKeysForOwner(self.ownerLabel);
      res.json({ items: keys.map(serializeKey) });
    } catch (err) {
      next(err);
    }
  });

  router.post("/keys", async (req, res, next) => {
    try {
      const self = await getApiKeyById(req.apiKeyId!);
      if (!self) throw new ApiError(401, "Missing or invalid x-api-key header.");

      const rawKey = `swg_${crypto.randomBytes(24).toString("hex")}`;
      const record = await createApiKey(rawKey, self.ownerLabel);

      res.status(201).json({ apiKey: rawKey, createdAt: record.createdAt, warning: "Save this key now — it will never be shown again." });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/keys/:id", async (req, res, next) => {
    try {
      const self = await getApiKeyById(req.apiKeyId!);
      if (!self) throw new ApiError(401, "Missing or invalid x-api-key header.");

      const target = await getApiKeyById(req.params.id);
      if (!target) throw new ApiError(404, "Key not found.");
      if (target.ownerLabel !== self.ownerLabel) throw new ApiError(403, "Not permitted.");

      await setApiKeyActive(target.id, false);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
