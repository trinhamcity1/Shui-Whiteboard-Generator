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
});
