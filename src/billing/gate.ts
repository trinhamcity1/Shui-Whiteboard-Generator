import { ApiError } from "../api/errors";
import { getTierConfig, type TierId } from "./tiers";
import { WORDS_PER_SECOND } from "../schema/planning";
import { DEFAULT_TARGET_DURATION_SECONDS } from "../schema/scriptWriting";

export type BillingMode = "base" | "topic";

/** Which per-minute rate a request bills at — derived from the same shape check videos.ts's route already does, not re-guessed independently. */
export function resolveBillingMode(request: { topic?: unknown }): BillingMode {
  return "topic" in request && request.topic !== undefined ? "topic" : "base";
}

export function creditsPerMinuteFor(tier: TierId, mode: BillingMode): number {
  const config = getTierConfig(tier);
  if (mode === "topic") {
    if (config.topicCreditsPerMinute === null) {
      throw new ApiError(403, `Topic mode is not available on the ${config.name} plan.`);
    }
    return config.topicCreditsPerMinute;
  }
  return config.baseCreditsPerMinute;
}

export function assertApiAccess(tier: TierId): void {
  const config = getTierConfig(tier);
  if (!config.apiAccess) {
    throw new ApiError(403, `The ${config.name} plan does not include direct API access — generate videos from the web dashboard instead.`);
  }
}

export function assertEchoAccess(tier: TierId): void {
  const config = getTierConfig(tier);
  if (!config.echoAccess) {
    throw new ApiError(403, `Echo model training requires the Pyramidion plan (this account is on ${config.name}).`);
  }
}

export function assertOrientationAllowed(tier: TierId, orientation: "vertical" | "horizontal" | undefined): void {
  const config = getTierConfig(tier);
  if (config.verticalOnly && orientation === "horizontal") {
    throw new ApiError(400, `The ${config.name} plan only supports vertical videos.`);
  }
}

export function assertLengthAllowed(tier: TierId, estimatedMinutes: number): void {
  const config = getTierConfig(tier);
  if (estimatedMinutes > config.maxLengthMinutes) {
    throw new ApiError(
      400,
      `The ${config.name} plan supports videos up to ${config.maxLengthMinutes} minutes (this request is roughly ${estimatedMinutes.toFixed(1)}).`,
    );
  }
}

/** A cheap, pre-render estimate of a request's length in minutes — good
 * enough to gate obviously-too-long requests and to sanity-check the
 * account has *some* chance of affording this before any real work starts.
 * The real billed amount always comes from the actual rendered duration
 * afterward (see renderHandler.ts) — this is deliberately just a fast
 * upper-bound guess, not the number that gets charged.
 *
 * `mode` matters: a topic-mode request with no explicit
 * targetDurationSeconds still produces a real ~60s video downstream (see
 * scriptWriting.ts's own default) — treating that as "0, nothing to
 * estimate" would silently skip both the max-length gate and the
 * insufficient-credits pre-check for the single most common topic-mode
 * request shape. Caught live: a topic request with an empty wallet reached
 * job creation instead of a clean 402. */
export function estimateRequestMinutes(args: {
  mode: BillingMode;
  narrationScript?: string;
  targetDurationSeconds?: number;
}): number {
  if (args.targetDurationSeconds !== undefined) return args.targetDurationSeconds / 60;
  if (args.narrationScript) {
    const wordCount = args.narrationScript.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(3, wordCount / WORDS_PER_SECOND) / 60;
  }
  if (args.mode === "topic") return DEFAULT_TARGET_DURATION_SECONDS / 60;
  return 0; // base mode with no narrationScript to estimate from shouldn't happen — every caller passes one
}
