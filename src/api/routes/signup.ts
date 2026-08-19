import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../errors";
import { createApiKey } from "../../storage/firestore";
import { signupRateLimit } from "../middleware/signupRateLimit";

const SignupBody = z.object({ email: z.string().email() }).strict();

/**
 * The one route in the whole API reachable with no x-api-key — it's how
 * a stranger gets their first one. Mounted outside the requireApiKey
 * chain in server.ts. Its own IP-based rate limit (see
 * signupRateLimit.ts) is applied directly to this one route, not at the
 * app.use("/v1", ...) mount level — Express runs a path-mounted
 * middleware for every request under that prefix regardless of which
 * router ends up handling it, so mounting it any higher rate-limits
 * every /v1/* request off this endpoint's own bucket, not just signups
 * (caught on a real local test: a handful of unrelated /v1/keys calls
 * exhausted the 5/hour bucket and started 429-ing everything).
 */
export function signupRouter(): Router {
  const router = Router();

  router.post("/signup", signupRateLimit, async (req, res, next) => {
    try {
      const result = SignupBody.safeParse(req.body);
      if (!result.success) {
        throw new ApiError(422, result.error.issues.map((issue) => ({ loc: issue.path, msg: issue.message })));
      }

      const rawKey = `swg_${crypto.randomBytes(24).toString("hex")}`;
      const record = await createApiKey(rawKey, result.data.email);

      res.status(201).json({
        apiKey: rawKey,
        email: result.data.email,
        createdAt: record.createdAt,
        warning: "Save this key now — it will never be shown again.",
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
