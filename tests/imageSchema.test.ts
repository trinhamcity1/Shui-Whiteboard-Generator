import { describe, expect, it } from "vitest";
import { SceneDocument } from "../src/schema/scene";

const base = {
  schemaVersion: 1,
  narrationScript: "Hello.",
  voice: "v",
  styleVariant: "classic-whiteboard",
  orientation: "vertical",
};

describe("SceneAction image fields", () => {
  it("accepts fullBleedGraphic with imageConcept and no imageUrl", () => {
    const doc = {
      ...base,
      actions: [
        { id: "a1", type: "fullBleedGraphic", atSeconds: 0, durationSeconds: 5, imageConcept: "a simple line drawing of a ballot box" },
      ],
    };
    expect(SceneDocument.safeParse(doc).success).toBe(true);
  });

  it("accepts documentReveal with imageUrl and no imageConcept (human-authored path unaffected)", () => {
    const doc = {
      ...base,
      actions: [{ id: "a1", type: "documentReveal", atSeconds: 0, durationSeconds: 5, imageUrl: "https://example.com/doc.png" }],
    };
    expect(SceneDocument.safeParse(doc).success).toBe(true);
  });

  it("rejects fullBleedGraphic with neither imageUrl nor imageConcept", () => {
    const doc = {
      ...base,
      actions: [{ id: "a1", type: "fullBleedGraphic", atSeconds: 0, durationSeconds: 5 }],
    };
    expect(SceneDocument.safeParse(doc).success).toBe(false);
  });

  it("rejects an imageConcept longer than 600 characters", () => {
    const doc = {
      ...base,
      actions: [
        {
          id: "a1",
          type: "fullBleedGraphic",
          atSeconds: 0,
          durationSeconds: 5,
          imageConcept: "x".repeat(601),
        },
      ],
    };
    expect(SceneDocument.safeParse(doc).success).toBe(false);
  });
});
