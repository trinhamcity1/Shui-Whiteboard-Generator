import { describe, expect, it } from "vitest";
import { buildAssetPrompt } from "../src/images/assetLibrary/promptTemplate";
import { ASSET_MANIFEST } from "../src/images/assetLibrary/manifest";

describe("buildAssetPrompt", () => {
  it("builds a character prompt with attire/direction/pose substituted", () => {
    const prompt = buildAssetPrompt({
      id: "test-character",
      tier: "shared",
      role: "character",
      provider: "recraft",
      pose: "explaining",
      direction: "forward",
      attire: "wearing a robe",
    });
    expect(prompt).toContain("wearing a robe");
    expect(prompt).toContain("Orientation: forward");
    expect(prompt).toContain("Pose: explaining");
    expect(prompt).toContain("transparent background");
    expect(prompt).not.toContain("[");
  });

  it("builds a prop prompt without character-only clauses", () => {
    const prompt = buildAssetPrompt({
      id: "test-prop",
      tier: "shared",
      role: "prop",
      provider: "flux",
      description: "a green checkmark",
    });
    expect(prompt).toContain("a green checkmark");
    expect(prompt).not.toContain("facial features");
    expect(prompt).not.toContain("attire");
  });

  it("throws a clear error for a character entry missing pose/direction/attire", () => {
    expect(() =>
      buildAssetPrompt({ id: "bad", tier: "shared", role: "character", provider: "recraft" }),
    ).toThrow(/missing/i);
  });

  it("throws a clear error for a prop entry missing a description", () => {
    expect(() => buildAssetPrompt({ id: "bad", tier: "shared", role: "prop", provider: "flux" })).toThrow(
      /missing/i,
    );
  });
});

describe("ASSET_MANIFEST", () => {
  it("has no duplicate ids", () => {
    const ids = ASSET_MANIFEST.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry has a valid tier and role", () => {
    for (const entry of ASSET_MANIFEST) {
      expect(["shared", "civics"]).toContain(entry.tier);
      expect(["character", "prop"]).toContain(entry.role);
      expect(["recraft", "flux"]).toContain(entry.provider);
    }
  });

  it("every character entry has pose/direction/attire; every prop entry has a description", () => {
    for (const entry of ASSET_MANIFEST) {
      if (entry.role === "character") {
        expect(entry.pose, `${entry.id} missing pose`).toBeTruthy();
        expect(entry.direction, `${entry.id} missing direction`).toBeTruthy();
        expect(entry.attire, `${entry.id} missing attire`).toBeTruthy();
      } else {
        expect(entry.description, `${entry.id} missing description`).toBeTruthy();
      }
    }
  });

  it("flags at least one test asset per tier the amendment's step-1 batch should cover", () => {
    const testEntries = ASSET_MANIFEST.filter((e) => e.isTest);
    expect(testEntries.length).toBeGreaterThanOrEqual(2);
    expect(testEntries.some((e) => e.tier === "shared")).toBe(true);
    expect(testEntries.some((e) => e.tier === "civics")).toBe(true);
  });

  it("every multi-pose Recraft character shares one characterFamily", () => {
    const families = new Map<string, Set<string>>();
    for (const entry of ASSET_MANIFEST) {
      if (entry.provider !== "recraft" || !entry.characterFamily) continue;
      if (!families.has(entry.characterFamily)) families.set(entry.characterFamily, new Set());
      families.get(entry.characterFamily)!.add(entry.id);
    }
    expect(families.get("narrator")?.size).toBe(4);
    expect(families.get("civics-judge")?.size).toBe(2);
    expect(families.get("civics-officer")?.size).toBe(2);
  });
});
