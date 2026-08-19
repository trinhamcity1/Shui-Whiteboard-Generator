import { beforeEach, describe, expect, it } from "vitest";
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
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("accepts a pre-authored scenes payload as-is, with no scenePlanning cost", async () => {
    const { sceneDocument, scenePlanning } = await resolveSceneDocument({ scenes });
    expect(sceneDocument.actions).toHaveLength(1);
    expect(scenePlanning).toBeUndefined();
  });

  it("rejects a request with neither scenes nor narrationScript", async () => {
    await expect(resolveSceneDocument({} as never)).rejects.toThrow(/either/i);
  });

  it("rejects a request with both scenes and narrationScript", async () => {
    await expect(
      resolveSceneDocument({
        scenes,
        narrationScript: "x",
        voice: "v",
        styleVariant: "classic-whiteboard",
      } as never),
    ).rejects.toThrow(/not both/i);
  });

  it("script-only path fails clearly without an ANTHROPIC_API_KEY configured", async () => {
    await expect(
      resolveSceneDocument({ narrationScript: "x", voice: "v", styleVariant: "classic-whiteboard" }),
    ).rejects.toThrow(/ANTHROPIC_API_KEY/i);
  });

  it("script-only path rejects a malformed request shape before ever calling the planner", async () => {
    await expect(resolveSceneDocument({ narrationScript: "x" } as never)).rejects.toThrow();
  });
});
