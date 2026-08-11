import { describe, expect, it } from "vitest";
import { SceneDocument, parseSceneDocument } from "../src/schema/scene";

const validDocument = {
  schemaVersion: 1,
  narrationScript: "Hello world.",
  voice: "voice-id",
  styleVariant: "classic-whiteboard",
  orientation: "vertical",
  actions: [
    { id: "a1", type: "titleCard", atSeconds: 0, durationSeconds: 3, text: "Title" },
    { id: "a2", type: "bulletList", atSeconds: 3, durationSeconds: 5, items: ["One", "Two"] },
  ],
};

describe("SceneDocument schema", () => {
  it("accepts a well-formed document", () => {
    const result = SceneDocument.safeParse(validDocument);
    expect(result.success).toBe(true);
  });

  it("rejects a bulletList action missing items", () => {
    const malformed = {
      ...validDocument,
      actions: [{ id: "a1", type: "bulletList", atSeconds: 0, durationSeconds: 3 }],
    };
    const result = SceneDocument.safeParse(malformed);
    expect(result.success).toBe(false);
  });

  it("rejects an unknown action type", () => {
    const malformed = {
      ...validDocument,
      actions: [{ id: "a1", type: "regionMap", atSeconds: 0, durationSeconds: 3 }],
    };
    const result = SceneDocument.safeParse(malformed);
    expect(result.success).toBe(false);
  });

  it("rejects an empty actions array", () => {
    const malformed = { ...validDocument, actions: [] };
    const result = SceneDocument.safeParse(malformed);
    expect(result.success).toBe(false);
  });

  it("parseSceneDocument throws a single readable error, not a raw crash", () => {
    expect(() => parseSceneDocument({ narrationScript: "x" })).toThrow(/Invalid SceneDocument/);
  });

  it("parseSceneDocument returns the parsed document on success", () => {
    const parsed = parseSceneDocument(validDocument);
    expect(parsed.actions).toHaveLength(2);
    expect(parsed.orientation).toBe("vertical");
  });
});
