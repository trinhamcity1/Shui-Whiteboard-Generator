import { describe, expect, it } from "vitest";
import { resolveSceneDocument } from "../src/pipeline/resolveSceneDocument";

const scenes = {
  schemaVersion: 1,
  narrationScript: "Hello.",
  voice: "v",
  styleVariant: "classic-whiteboard",
  orientation: "vertical",
  actions: [{ id: "a1", type: "titleCard", atSeconds: 0, durationSeconds: 3, text: "Hi" }],
};

describe("resolveSceneDocument", () => {
  it("accepts a pre-authored scenes payload as-is", () => {
    const doc = resolveSceneDocument({ scenes });
    expect(doc.actions).toHaveLength(1);
  });

  it("rejects a request with neither scenes nor narrationScript", () => {
    expect(() => resolveSceneDocument({} as never)).toThrow(/either/i);
  });

  it("rejects a request with both scenes and narrationScript", () => {
    expect(() =>
      resolveSceneDocument({
        scenes,
        narrationScript: "x",
        voice: "v",
        styleVariant: "classic-whiteboard",
      } as never),
    ).toThrow(/not both/i);
  });

  it("script-only path calls the not-yet-implemented planner and fails clearly", () => {
    expect(() =>
      resolveSceneDocument({ narrationScript: "x", voice: "v", styleVariant: "classic-whiteboard" }),
    ).toThrow(/not implemented/i);
  });
});
