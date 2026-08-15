import crypto from "node:crypto";
import { createLibraryAsset, type LibraryAssetRecord } from "../../storage/firestore";
import { listAllLibraryAssets } from "./registryLookup";
import { appendLocalLibraryAsset } from "./localRegistry";
import { findSemanticMatch } from "./semanticMatch";
import { detectLabelAnchor } from "./anchorDetection";
import { uploadBufferToR2 } from "../../storage/r2";
import { TrainedStyleImageProvider } from "../trainedStyle";
import type { StyleModelVersion } from "../styleModel/types";

export interface AutoExpandResult {
  imageUrl: string;
  widthPx: number;
  heightPx: number;
  assetId: string;
  reused: boolean; // true on a semantic/exact match — $0, no generation
  costUsd: number;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function slugify(concept: string): string {
  const base = normalize(concept)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40)
    .replace(/-+$/, "");
  const suffix = crypto.createHash("sha256").update(concept).digest("hex").slice(0, 6);
  return `auto-${base || "asset"}-${suffix}`;
}

/**
 * Layer 2's actual flow, run on every imageConcept cache-miss instead of a
 * throwaway one-off generation: check for a reusable near-match first, and
 * if nothing matches, generate through the trained model and add the
 * result to the (quarantined) shared registry — every live generation
 * makes the library more complete instead of being spent once and
 * forgotten. See the revision-2 doc, Layer 2.
 */
export async function resolveConceptViaLibrary(
  concept: string,
  opts: { falApiKey: string; anthropicApiKey?: string; styleModel: StyleModelVersion },
): Promise<AutoExpandResult> {
  const allAssets = await listAllLibraryAssets();
  // Only promoted assets are eligible for reuse — a still-quarantined asset
  // hasn't cleared the shared-registry bar yet (revision-2 doc, Layer 2
  // step 4), so it stays private to the video that spawned it until then.
  const promoted = allAssets.filter((a) => a.quarantineStatus === "promoted");

  const exactMatch = promoted.find((a) => normalize(a.description) === normalize(concept));
  if (exactMatch) {
    return {
      imageUrl: exactMatch.imageUrl,
      widthPx: exactMatch.widthPx,
      heightPx: exactMatch.heightPx,
      assetId: exactMatch.id,
      reused: true,
      costUsd: 0,
    };
  }

  const semanticResult = await findSemanticMatch(concept, promoted, { apiKey: opts.anthropicApiKey });
  if (semanticResult.matchedAssetId) {
    const matched = promoted.find((a) => a.id === semanticResult.matchedAssetId)!;
    return {
      imageUrl: matched.imageUrl,
      widthPx: matched.widthPx,
      heightPx: matched.heightPx,
      assetId: matched.id,
      reused: true,
      costUsd: semanticResult.costUsd,
    };
  }

  // No match — generate through the trained LoRA (same model the v1
  // library used, so a live fallback matches the library by construction).
  const provider = new TrainedStyleImageProvider(opts.falApiKey, opts.styleModel);
  const raw = await provider.generate(concept, { styleVariant: "classic-whiteboard", orientation: "vertical" });

  const assetId = slugify(concept);
  const r2Key = `assets/auto-expanded/${assetId}.png`;
  const { url } = await uploadBufferToR2({ buffer: raw.imageBuffer, key: r2Key, contentType: raw.contentType });

  const anchorResult = await detectLabelAnchor(raw.imageBuffer, { apiKey: opts.anthropicApiKey });

  const record: LibraryAssetRecord = {
    id: assetId,
    tier: "shared",
    role: "prop",
    provider: "trained-style",
    r2Key,
    imageUrl: url,
    widthPx: raw.widthPx,
    heightPx: raw.heightPx,
    costUsd: raw.costUsd,
    generatedAt: new Date().toISOString(),
    description: concept,
    origin: "auto-expanded",
    // Always starts quarantined — the automated check (dimensions,
    // transparency, style self-check) runs as a separate promotion step,
    // never inline at generation time, so one slow/failed check can't block
    // the video that needed this asset right now.
    quarantineStatus: "pending",
    labelAnchor: anchorResult.labelAnchor ?? undefined,
    dominantColor: anchorResult.dominantColor ?? undefined,
  };

  try {
    await createLibraryAsset(record);
  } catch {
    appendLocalLibraryAsset(record);
  }

  return {
    imageUrl: url,
    widthPx: raw.widthPx,
    heightPx: raw.heightPx,
    assetId,
    reused: false,
    costUsd: raw.costUsd + semanticResult.costUsd + anchorResult.costUsd,
  };
}
