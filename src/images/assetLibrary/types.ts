import type { ImageProviderName } from "../types";

export type AssetTier = "shared" | "civics";
export type AssetRole = "character" | "prop";

/** Persisted record — matches the amendment doc's LibraryAsset interface (§4). */
export interface LibraryAsset {
  id: string;
  tier: AssetTier;
  role: AssetRole;
  provider: ImageProviderName;
  r2Key: string;
  imageUrl: string;
  widthPx: number;
  heightPx: number;
  costUsd: number;
  generatedAt: string;
}

/** One row of the generation manifest — the input to scripts/generate-asset-library.ts. */
export interface AssetManifestEntry {
  id: string;
  tier: AssetTier;
  role: AssetRole;
  provider: ImageProviderName;
  // Characters: all three required — substituted into the §3 template.
  pose?: string;
  direction?: string; // e.g. "forward", "three-quarters left"
  attire?: string; // substituted into "[role-appropriate attire]"
  // Props: a plain description instead — the §3 template's character-only
  // clauses (facial features, attire, pose) don't apply to an inanimate object.
  description?: string;
  /** Groups poses of the same character (e.g. "narrator", "civics-judge") so they share one Recraft style_id for a consistent look. */
  characterFamily?: string;
  /** True for the small set generated first and reviewed against the Golpo reference before the full batch runs (amendment §8, step 1). */
  isTest?: boolean;
}
