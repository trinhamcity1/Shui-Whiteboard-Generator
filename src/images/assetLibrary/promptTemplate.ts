import type { AssetManifestEntry } from "./types";

const SHARED_STYLE_CLAUSE =
  "Flat vector illustration in a modern \"explainer video\" style. Clean, uniform black " +
  "outlines with rounded line caps — no sketchy or hand-wobbled linework. Flat cel-shaded " +
  "color fill only, no gradients or interior shading. Standalone reusable asset on a " +
  "transparent background. No text, no lettering, no background scenery.";

/**
 * The character half of the base template from the Phase 4 amendment doc
 * (§3), dissected from the actual Golpo reference frame rather than
 * guessed: clean uniform vector outlines, flat cel-shaded color, minimal
 * facial detail. Deliberately NOT the sketchy/hand-wobbled look — that's
 * reserved for rough.js-drawn diagrams, a different aesthetic for a
 * different job.
 */
function buildCharacterPrompt(entry: Required<Pick<AssetManifestEntry, "attire" | "direction" | "pose">>): string {
  return (
    `${SHARED_STYLE_CLAUSE} Simple, friendly character design with minimal facial features ` +
    `(dot eyes, simple mouth line, little to no nose), rounded proportions, ${entry.attire}. ` +
    `Facing ${entry.direction}, in a ${entry.pose} pose.`
  );
}

/** The §3 template's character-only clauses (facial features, attire, pose) don't apply to an inanimate object. */
function buildPropPrompt(entry: Required<Pick<AssetManifestEntry, "description">>): string {
  return `${SHARED_STYLE_CLAUSE} ${entry.description}.`;
}

export function buildAssetPrompt(entry: AssetManifestEntry): string {
  if (entry.role === "character") {
    if (!entry.attire || !entry.direction || !entry.pose) {
      throw new Error(`Character asset "${entry.id}" is missing attire/direction/pose.`);
    }
    return buildCharacterPrompt({ attire: entry.attire, direction: entry.direction, pose: entry.pose });
  }
  if (!entry.description) {
    throw new Error(`Prop asset "${entry.id}" is missing a description.`);
  }
  return buildPropPrompt({ description: entry.description });
}
