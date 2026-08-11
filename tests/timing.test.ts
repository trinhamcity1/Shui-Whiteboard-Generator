import { describe, expect, it } from "vitest";
import { checkSceneTiming } from "../src/render/timing";
import type { SceneDocument } from "../src/schema/scene";

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
