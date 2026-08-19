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

// Deliberately irregular pacing (a real pause before "jumps" and a longer
// one before "again") — the exact shape of real speech a flat-rate
// estimate can't see, and the reason coversText-based matching replaced it.
const IRREGULAR_WORDS: WordTiming[] = [
  { word: "The", startSeconds: 0.0, endSeconds: 0.3 },
  { word: "quick", startSeconds: 0.35, endSeconds: 0.7 },
  { word: "brown", startSeconds: 0.75, endSeconds: 1.1 },
  { word: "fox", startSeconds: 1.15, endSeconds: 1.3 },
  { word: "jumps", startSeconds: 1.9, endSeconds: 2.2 }, // pause before this word
  { word: "over", startSeconds: 2.25, endSeconds: 2.45 },
  { word: "the", startSeconds: 2.5, endSeconds: 2.6 },
  { word: "lazy", startSeconds: 2.65, endSeconds: 2.95 },
  { word: "dog", startSeconds: 3.0, endSeconds: 3.25 },
  { word: "again", startSeconds: 4.0, endSeconds: 4.5 }, // longer pause before this word
];

describe("realignSceneTiming (coversText word-span matching)", () => {
  it("locates each action's exact real timing from its coversText, tracking irregular pacing a flat rate can't", () => {
    const doc = docWithActions([
      { id: "a1", type: "titleCard", atSeconds: 0, durationSeconds: 2, text: "Title", coversText: "The quick brown fox" },
      { id: "a2", type: "titleCard", atSeconds: 2, durationSeconds: 2, text: "Ending", coversText: "jumps over the lazy dog again" },
    ]);
    realignSceneTiming(doc, IRREGULAR_WORDS);

    expect(doc.actions[0]!.atSeconds).toBeCloseTo(0.0, 5);
    expect(doc.actions[0]!.atSeconds + doc.actions[0]!.durationSeconds).toBeCloseTo(1.3, 5);
    // The real pause before "jumps" (1.3s -> 1.9s) is exactly the kind of
    // gap a WORDS_PER_SECOND estimate would smear across both scenes
    // instead of attributing correctly to the second one.
    expect(doc.actions[1]!.atSeconds).toBeCloseTo(1.9, 5);
    expect(doc.actions[1]!.atSeconds + doc.actions[1]!.durationSeconds).toBeCloseTo(4.5, 5);
  });

  it("tolerates a minor word mismatch (voice model expanding a contraction, etc.)", () => {
    const doc = docWithActions([
      // "quick" swapped for a word that isn't there — 3 of 4 words still match.
      { id: "a1", type: "titleCard", atSeconds: 0, durationSeconds: 2, text: "Title", coversText: "The swift brown fox" },
    ]);
    realignSceneTiming(doc, IRREGULAR_WORDS);
    expect(doc.actions[0]!.atSeconds).toBeCloseTo(0.0, 5);
  });

  it("falls back to the rate estimate for one action when its coversText can't be located at all", () => {
    const doc = docWithActions([
      { id: "a1", type: "titleCard", atSeconds: 10, durationSeconds: 4, text: "Title", coversText: "completely unrelated words never spoken" },
    ]);
    const wordTimings = syntheticWordTimings(50);
    realignSceneTiming(doc, wordTimings);
    // Falls through to the same rate-based math as the no-coversText case below.
    expect(doc.actions[0]!.atSeconds).toBeCloseTo(wordTimings[25]!.startSeconds, 5);
  });
});

describe("realignSceneTiming (rate-based fallback, no coversText)", () => {
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
