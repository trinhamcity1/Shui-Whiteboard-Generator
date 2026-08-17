// Published Cloud Run Gen2 rate, approximate: ~$0.000024/vCPU-second and
// ~$0.0000025/GiB-second. Phase 0/1 run locally, so this is a projection of
// what the same wall-clock time would cost on Cloud Run, not a real bill.
const CLOUD_RUN_VCPU_SECOND_USD = 0.000024;
const CLOUD_RUN_GIB_SECOND_USD = 0.0000025;
const ASSUMED_VCPUS = 2;
const ASSUMED_GIB = 4;

export interface RenderCostEstimate {
  renderWallClockSeconds: number;
  renderComputeCostUsd: number;
}

export function estimateRenderComputeCost(renderWallClockSeconds: number): RenderCostEstimate {
  const vcpuCost = renderWallClockSeconds * ASSUMED_VCPUS * CLOUD_RUN_VCPU_SECOND_USD;
  const memCost = renderWallClockSeconds * ASSUMED_GIB * CLOUD_RUN_GIB_SECOND_USD;
  return {
    renderWallClockSeconds,
    renderComputeCostUsd: vcpuCost + memCost,
  };
}

export interface JobCost {
  ttsCharacters: number;
  ttsCostUsd: number;
  scenePlanningLLMTokens?: number;
  scenePlanningCostUsd?: number;
  imagesGenerated?: number;
  imageCacheHits?: number;
  imageGenerationCostUsd?: number;
  imageProvider?: "recraft" | "flux" | "trained-style";
  /** Revision-3 Workstream 4: one vision-LLM critique call (+ one bounded correction, never a re-check) per composed scene. */
  layoutQaCostUsd?: number;
  renderWallClockSeconds: number;
  renderComputeCostUsd: number;
  totalCostUsd: number;
}

export function buildJobCost(args: {
  ttsCharacters: number;
  ttsCostUsd: number;
  renderWallClockSeconds: number;
  scenePlanningLLMTokens?: number;
  scenePlanningCostUsd?: number;
  imagesGenerated?: number;
  imageCacheHits?: number;
  imageGenerationCostUsd?: number;
  imageProvider?: "recraft" | "flux" | "trained-style";
  layoutQaCostUsd?: number;
}): JobCost {
  const { renderComputeCostUsd } = estimateRenderComputeCost(args.renderWallClockSeconds);
  const scenePlanningCostUsd = args.scenePlanningCostUsd ?? 0;
  const imageGenerationCostUsd = args.imageGenerationCostUsd ?? 0;
  const layoutQaCostUsd = args.layoutQaCostUsd ?? 0;
  return {
    ttsCharacters: args.ttsCharacters,
    ttsCostUsd: args.ttsCostUsd,
    scenePlanningLLMTokens: args.scenePlanningLLMTokens,
    scenePlanningCostUsd: args.scenePlanningCostUsd,
    imagesGenerated: args.imagesGenerated,
    imageCacheHits: args.imageCacheHits,
    imageGenerationCostUsd: args.imageGenerationCostUsd,
    imageProvider: args.imageProvider,
    layoutQaCostUsd: args.layoutQaCostUsd,
    renderWallClockSeconds: args.renderWallClockSeconds,
    renderComputeCostUsd,
    totalCostUsd: args.ttsCostUsd + renderComputeCostUsd + scenePlanningCostUsd + imageGenerationCostUsd + layoutQaCostUsd,
  };
}

export function printJobCost(cost: JobCost, label?: string): void {
  // Non-illustrated target carries over from Phases 0-3; once a job
  // actually generates images, the relevant ceiling is the Phase 4
  // direction update's worst-case illustrated figure instead.
  const usesImages = (cost.imagesGenerated ?? 0) > 0 || (cost.imageCacheHits ?? 0) > 0;
  const target = usesImages ? { low: 0.05, high: 0.27 } : { low: 0.05, high: 0.2 };
  const withinTarget = cost.totalCostUsd >= 0 && cost.totalCostUsd <= target.high * 1.5;

  console.log(`\n--- Job Cost Breakdown${label ? ` (${label})` : ""} ---`);
  console.log(`TTS:      ${cost.ttsCharacters} characters -> $${cost.ttsCostUsd.toFixed(4)}`);
  if (cost.scenePlanningCostUsd !== undefined) {
    console.log(
      `Planning: ${cost.scenePlanningLLMTokens ?? 0} tokens -> $${cost.scenePlanningCostUsd.toFixed(4)}`,
    );
  }
  if (usesImages) {
    console.log(
      `Images:   ${cost.imagesGenerated ?? 0} generated, ${cost.imageCacheHits ?? 0} cache hits (${cost.imageProvider ?? "?"}) -> $${(cost.imageGenerationCostUsd ?? 0).toFixed(4)}`,
    );
  }
  if (cost.layoutQaCostUsd) {
    console.log(`LayoutQA: -> $${cost.layoutQaCostUsd.toFixed(4)}`);
  }
  console.log(
    `Render:   ${cost.renderWallClockSeconds.toFixed(1)}s wall-clock -> $${cost.renderComputeCostUsd.toFixed(4)} (Cloud Run estimate)`,
  );
  console.log(`TOTAL:    $${cost.totalCostUsd.toFixed(4)}`);
  console.log(`Target:   $${target.low.toFixed(2)}-$${target.high.toFixed(2)}/minute${usesImages ? " (illustrated)" : ""}`);
  if (!withinTarget) {
    console.warn(
      `\n⚠️  WARNING: total cost is well outside the $${target.low.toFixed(2)}-$${target.high.toFixed(2)}/minute target this project is betting on. Flag this loudly.`,
    );
  }
  console.log("---------------------------\n");
}
