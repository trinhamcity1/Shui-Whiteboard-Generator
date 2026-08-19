import type { AssetManifestEntry } from "../assetLibrary/types";
import { SHARED_STYLE } from "./candidatePrompts";

// Revision 3: same art direction as candidatePrompts.ts's SHARED_STYLE
// (confident near-black ink, mostly uncolored with selective flat color
// accents), plus the one addition library assets specifically need — a
// FLAT, SOLID, PERFECTLY UNIFORM background so removeFlatBackground's
// flood-fill actually works on every generated asset.
//
// The real root cause of a ~40% face-on-props failure rate, found after
// a negative-instruction fix ("must NOT have a face") failed twice in a
// row: SHARED_STYLE itself hardcodes the literal phrase "simple cartoon
// face" — written for character generation, but reused verbatim by every
// prop prompt too, since BASE_STYLE below is built directly from it. No
// amount of negative instruction elsewhere in the same prompt reliably
// beat a direct positive instruction sitting right next to it. Stripped
// out for props specifically here rather than editing SHARED_STYLE
// itself, which candidatePrompts.ts's own (character-focused) callers
// still depend on.
const STYLE_WITHOUT_FACE_CLAUSE = SHARED_STYLE.replace(/,?\s*simple cartoon face,?/, ",");

const BASE_STYLE_SUFFIX =
  ". Standalone illustration on a FLAT, SOLID, PERFECTLY UNIFORM off-white " +
  "background color — no vignette, no glow, no gradient, no shading or wash of any kind " +
  "behind the subject. No signature.";

const CHARACTER_BASE_STYLE = `${SHARED_STYLE}${BASE_STYLE_SUFFIX}`;
const PROP_BASE_STYLE = `${STYLE_WITHOUT_FACE_CLAUSE}${BASE_STYLE_SUFFIX}`;

export function buildLibraryPrompt(entry: AssetManifestEntry, triggerWord: string): string {
  if (entry.role === "character") {
    if (!entry.pose || !entry.direction || !entry.attire) {
      throw new Error(`Character asset "${entry.id}" is missing pose/direction/attire.`);
    }
    return (
      `${triggerWord}, ${CHARACTER_BASE_STYLE} Subject: a character ${entry.attire}. ` +
      `Orientation: ${entry.direction}. Pose: ${entry.pose}.`
    );
  }
  if (!entry.description) {
    throw new Error(`Prop asset "${entry.id}" is missing a description.`);
  }
  return (
    `${triggerWord}, ${PROP_BASE_STYLE} Subject: ${entry.description}. This is a plain ` +
    "inanimate object or icon, not a character."
  );
}
