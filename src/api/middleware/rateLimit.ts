import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../errors";

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

// Generous by design — Phase 2 has exactly one trusted caller. The point
// isn't constraining anyone today; it's that tightening this for a public
// tier in Phase 4 is a config change, not new code.
const CAPACITY = 60;
const REFILL_PER_SECOND = 1; // 60/minute

const buckets = new Map<string, Bucket>();

function takeToken(apiKeyId: string): boolean {
  const now = Date.now();
  let bucket = buckets.get(apiKeyId);
  if (!bucket) {
    bucket = { tokens: CAPACITY, lastRefillMs: now };
    buckets.set(apiKeyId, bucket);
  }

  const elapsedSeconds = (now - bucket.lastRefillMs) / 1000;
  bucket.tokens = Math.min(CAPACITY, bucket.tokens + elapsedSeconds * REFILL_PER_SECOND);
  bucket.lastRefillMs = now;

  if (bucket.tokens < 1) {
    return false;
  }
  bucket.tokens -= 1;
  return true;
}

export function rateLimit(req: Request, _res: Response, next: NextFunction): void {
  const apiKeyId = req.apiKeyId;
  if (!apiKeyId) {
    // Auth middleware should always run first; if it didn't, fail closed.
    next(new ApiError(401, "Missing or invalid x-api-key header."));
    return;
  }

  if (!takeToken(apiKeyId)) {
    next(new ApiError(429, "Rate limit exceeded. Please slow down."));
    return;
  }

  next();
}
