import { describe, expect, it } from "vitest";
import { checkSceneTiming, realignSceneTiming } from "../src/render/timing";
import type { SceneDocument } from "../src/schema/scene";
import type { WordTiming } from "../src/tts/types";

function docWithActions(actions: SceneDocument["actions"]): SceneDocument {
  return {
    schemaVersion: 1,
    narrationScript: "x",
    voice: "v",
    styleVariant: "classic-whiteboard",
    orientation: "vertical",
    actions,
  };
}

describe("checkSceneTiming", () => {
  it("produces no warnings when actions fit within the narration duration", () => {
    const doc = docWithActions([
      { id: "a1", type: "titleCard", atSeconds: 0, durationSeconds: 3, text: "Title" },
      { id: "a2", type: "bulletList", atSeconds: 3, durationSeconds: 27, items: ["One"] },
    ]);
    const result = checkSceneTiming(doc, 30);
    expect(result.warnings).toHaveLength(0);
  });

  it("warns, but does not throw, when an action runs past the narration", () => {
    const doc = docWithActions([{ id: "a1", type: "titleCard", atSeconds: 0, durationSeconds: 45, text: "Title" }]);
    const result = checkSceneTiming(doc, 10);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("a1"))).toBe(true);
  });

  it("warns when total scene duration drifts more than 10% from narration duration", () => {
    const doc = docWithActions([{ id: "a1", type: "titleCard", atSeconds: 0, durationSeconds: 5, text: "Title" }]);
    const result = checkSceneTiming(doc, 30); // 5s scene vs 30s narration, ~83% drift
    expect(result.warnings.some((w) => w.toLowerCase().includes("drift"))).toBe(true);
  });

  it("does not warn on drift within the 10% threshold", () => {
    const doc = docWithActions([{ id: "a1", type: "titleCard", atSeconds: 0, durationSeconds: 29, text: "Title" }]);
    const result = checkSceneTiming(doc, 30); // ~3% drift
    expect(result.warnings).toHaveLength(0);
  });
});

// Real audio here runs at ~1.67 words/sec (0.6s per word) — deliberately
// slower than the planner's WORDS_PER_SECOND=2.5 estimate, the same shape
// of drift caught on the real Trojan War render this fixes.
function syntheticWordTimings(count: number): WordTiming[] {
  return Array.from({ length: count }, (_, i) => ({
    word: `w${i}`,
    startSeconds: i * 0.6,
    endSeconds: i * 0.6 + 0.5,
  }));
}

describe("realignSceneTiming", () => {
  it("snaps an action's timing onto the real per-word timestamps instead of the flat-rate estimate", () => {
    const doc = docWithActions([{ id: "a1", type: "titleCard", atSeconds: 10, durationSeconds: 4, text: "Title" }]);
    const wordTimings = syntheticWordTimings(50);
    realignSceneTiming(doc, wordTimings);

    // atSeconds=10 under the 2.5 wps estimate implies word index 25.
    expect(doc.actions[0]!.atSeconds).toBeCloseTo(wordTimings[25]!.startSeconds, 5);
  });

  it("stretches the final action so the video never runs out of picture before the narration ends", () => {
    const doc = docWithActions([
      { id: "a1", type: "titleCard", atSeconds: 0, durationSeconds: 2, text: "Title" },
      { id: "a2", type: "titleCard", atSeconds: 8, durationSeconds: 2, text: "Ending" },
    ]);
    const wordTimings = syntheticWordTimings(60); // real audio runs to word 59's end
    realignSceneTiming(doc, wordTimings);

    const lastAction = doc.actions[doc.actions.length - 1]!;
    const lastRealEnd = wordTimings[wordTimings.length - 1]!.endSeconds;
    expect(lastAction.atSeconds + lastAction.durationSeconds).toBeCloseTo(lastRealEnd, 5);
  });

  it("is a no-op when there are no word timings to realign against", () => {
    const doc = docWithActions([{ id: "a1", type: "titleCard", atSeconds: 10, durationSeconds: 4, text: "Title" }]);
    realignSceneTiming(doc, undefined);
    expect(doc.actions[0]!.atSeconds).toBe(10);
    expect(doc.actions[0]!.durationSeconds).toBe(4);

    realignSceneTiming(doc, []);
    expect(doc.actions[0]!.atSeconds).toBe(10);
  });

  it("never collapses a scene to zero or negative duration", () => {
    const doc = docWithActions([{ id: "a1", type: "titleCard", atSeconds: 10, durationSeconds: 0.1, text: "Title" }]);
    const wordTimings = syntheticWordTimings(50);
    realignSceneTiming(doc, wordTimings);
    expect(doc.actions[0]!.durationSeconds).toBeGreaterThanOrEqual(0.5);
  });
});
