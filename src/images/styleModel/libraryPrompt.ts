import type { AssetManifestEntry } from "../assetLibrary/types";
import { SHARED_STYLE } from "./candidatePrompts";

// Revision 3: same art direction as candidatePrompts.ts's SHARED_STYLE
// (confident near-black ink, mostly uncolored with selective flat color
// accents), plus the one addition library assets specifically need — a
// FLAT, SOLID, PERFECTLY UNIFORM background so removeFlatBackground's
// flood-fill actually works on every generated asset.
const BASE_STYLE =
  `${SHARED_STYLE}. Standalone illustration on a FLAT, SOLID, PERFECTLY UNIFORM off-white ` +
  "background color — no vignette, no glow, no gradient, no shading or wash of any kind " +
  "behind the subject. No signature.";

export function buildLibraryPrompt(entry: AssetManifestEntry, triggerWord: string): string {
  if (entry.role === "character") {
    if (!entry.pose || !entry.direction || !entry.attire) {
      throw new Error(`Character asset "${entry.id}" is missing pose/direction/attire.`);
    }
    return (
      `${triggerWord}, ${BASE_STYLE} Subject: a character ${entry.attire}. ` +
      `Orientation: ${entry.direction}. Pose: ${entry.pose}.`
    );
  }
  if (!entry.description) {
    throw new Error(`Prop asset "${entry.id}" is missing a description.`);
  }
  return `${triggerWord}, ${BASE_STYLE} Subject: ${entry.description}.`;
}
