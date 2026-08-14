import type { AssetManifestEntry } from "../assetLibrary/types";

// Same discipline as candidatePrompts.ts's corrected STYLE_CLAUSE — flat,
// uniform background only, no atmospheric wash, so background removal
// actually works on every generated asset.
const BASE_STYLE =
  "warm painterly storybook illustration, soft gouache-textured brushwork on the subject " +
  "itself, warm earthy color palette (ochre, terracotta, sage green, cream). Standalone " +
  "illustration on a FLAT, SOLID, PERFECTLY UNIFORM cream background color — no vignette, " +
  "no glow, no gradient, no shading or wash of any kind behind the subject. No text, no " +
  "lettering, no watermark, no signature.";

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
