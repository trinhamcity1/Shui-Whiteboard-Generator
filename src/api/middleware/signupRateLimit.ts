import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../errors";

/**
 * rateLimit.ts's token bucket is keyed on req.apiKeyId — meaningless for
 * /signup, which is the one endpoint reachable with no key at all (it's
 * how you get your first one). Keyed on IP instead, and deliberately
 * tighter — an account-creation endpoint is a cheaper abuse target than a
 * render job (no Anthropic/ElevenLabs/fal.ai spend, just a Firestore
 * write), but unlimited signups is still a real way to flood the
 * apiKeys collection or work around a future per-account free-tier limit.
 */
const CAPACITY = 5;
const REFILL_PER_SECOND = 5 / 3600; // 5 per hour

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

const buckets = new Map<string, Bucket>();

function takeToken(ip: string): boolean {
  const now = Date.now();
  let bucket = buckets.get(ip);
  if (!bucket) {
    bucket = { tokens: CAPACITY, lastRefillMs: now };
    buckets.set(ip, bucket);
  }

  const elapsedSeconds = (now - bucket.lastRefillMs) / 1000;
  bucket.tokens = Math.min(CAPACITY, bucket.tokens + elapsedSeconds * REFILL_PER_SECOND);
  bucket.lastRefillMs = now;

  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

export function signupRateLimit(req: Request, _res: Response, next: NextFunction): void {
  const ip = req.ip ?? "unknown";
  if (!takeToken(ip)) {
    next(new ApiError(429, "Too many signup attempts from this address. Try again later."));
    return;
  }
  next();
}
