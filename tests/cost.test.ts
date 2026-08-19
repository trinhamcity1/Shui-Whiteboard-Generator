import { describe, expect, it } from "vitest";
import { buildJobCost, estimateRenderComputeCost } from "../src/cost/index";

describe("cost calculation", () => {
  it("estimates render compute cost as proportional to wall-clock time", () => {
    const short = estimateRenderComputeCost(10);
    const long = estimateRenderComputeCost(20);
    expect(long.renderComputeCostUsd).toBeCloseTo(short.renderComputeCostUsd * 2, 5);
  });

  it("builds a JobCost total from TTS + render, with no scene planning cost by default", () => {
    const cost = buildJobCost({ ttsCharacters: 1000, ttsCostUsd: 0.18, renderWallClockSeconds: 30 });
    expect(cost.scenePlanningCostUsd).toBeUndefined();
    expect(cost.totalCostUsd).toBeCloseTo(cost.ttsCostUsd + cost.renderComputeCostUsd, 6);
  });

  it("includes script writing cost in the total when the topic-only path is used", () => {
    const cost = buildJobCost({
      ttsCharacters: 1000,
      ttsCostUsd: 0.18,
      renderWallClockSeconds: 30,
      scriptWritingLLMTokens: 400,
      scriptWritingCostUsd: 0.004,
      scenePlanningLLMTokens: 1200,
      scenePlanningCostUsd: 0.01,
    });
    expect(cost.totalCostUsd).toBeCloseTo(cost.ttsCostUsd + cost.renderComputeCostUsd + 0.004 + 0.01, 6);
  });

  it("includes scene planning cost in the total when the script-only path is used", () => {
    const cost = buildJobCost({
      ttsCharacters: 1000,
      ttsCostUsd: 0.18,
      renderWallClockSeconds: 30,
      scenePlanningLLMTokens: 1200,
      scenePlanningCostUsd: 0.01,
    });
    expect(cost.totalCostUsd).toBeCloseTo(cost.ttsCostUsd + cost.renderComputeCostUsd + 0.01, 6);
  });

  it("keeps costs comfortably within the project's target band for a typical one-minute job", () => {
    const cost = buildJobCost({ ttsCharacters: 900, ttsCostUsd: 900 * 0.00018, renderWallClockSeconds: 45 });
    expect(cost.totalCostUsd).toBeLessThan(0.6); // 3x the $0.20 target, generous margin for a unit test
  });

  it("includes image generation cost in the total when illustrations were generated", () => {
    const cost = buildJobCost({
      ttsCharacters: 900,
      ttsCostUsd: 0.16,
      renderWallClockSeconds: 30,
      imagesGenerated: 2,
      imageCacheHits: 1,
      imageGenerationCostUsd: 0.16,
      imageProvider: "recraft",
    });
    expect(cost.totalCostUsd).toBeCloseTo(cost.ttsCostUsd + cost.renderComputeCostUsd + 0.16, 6);
    expect(cost.imagesGenerated).toBe(2);
    expect(cost.imageCacheHits).toBe(1);
  });

  it("a cache hit for every image contributes zero image cost", () => {
    const cost = buildJobCost({
      ttsCharacters: 900,
      ttsCostUsd: 0.16,
      renderWallClockSeconds: 30,
      imagesGenerated: 0,
      imageCacheHits: 3,
      imageGenerationCostUsd: 0,
      imageProvider: "flux",
    });
    expect(cost.totalCostUsd).toBeCloseTo(cost.ttsCostUsd + cost.renderComputeCostUsd, 6);
  });
});
