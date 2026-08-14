import type { SceneDocument } from "../schema/scene";
import type { ImageProvider, ImageProviderName } from "./types";
import { resolveImage } from "./cache";
import { resolveAssetId } from "./assetLibrary/registryLookup";

export interface ImageResolutionResult {
  imagesGenerated: number; // cache misses — real generations
  cacheHits: number;
  costUsd: number;
  provider?: ImageProviderName;
}

const CONCURRENCY = 3;

/**
 * Walks every action, resolving imageConcept -> imageUrl (cache-first) for
 * any action that has one but no imageUrl yet, then mutates the scene
 * document in place. Runs before TTS in resolveSceneDocument — same
 * position in the pipeline TTS itself occupies — so a failed image
 * generation fails fast and cheap, before the expensive render step.
 */
export async function resolveImages(
  sceneDocument: SceneDocument,
  opts: { provider: ImageProvider; orientation: "vertical" | "horizontal" },
): Promise<ImageResolutionResult> {
  // Revision-2 Layer 1: assetId is a registry lookup — $0, no live API
  // call — and resolves first, since it's the default path for any
  // recurring character/prop. imageConcept (live generation) only ever
  // runs for actions that don't select a library asset.
  const assetActions = sceneDocument.actions.filter((action) => action.assetId && !action.imageUrl);
  for (const action of assetActions) {
    const resolved = await resolveAssetId(action.assetId!);
    if (!resolved) {
      throw new Error(`assetId "${action.assetId}" was not found in the asset library registry.`);
    }
    action.imageUrl = resolved.imageUrl;
  }

  // Same registry lookup, for the characters flanking a sketchDiagram.
  const diagramActions = sceneDocument.actions.filter((action) => action.sketchDiagram);
  for (const action of diagramActions) {
    const diagram = action.sketchDiagram!;
    if (diagram.leftCharacterAssetId && !diagram.leftCharacterUrl) {
      const resolved = await resolveAssetId(diagram.leftCharacterAssetId);
      if (!resolved) {
        throw new Error(`sketchDiagram leftCharacterAssetId "${diagram.leftCharacterAssetId}" was not found in the asset library registry.`);
      }
      diagram.leftCharacterUrl = resolved.imageUrl;
    }
    if (diagram.rightCharacterAssetId && !diagram.rightCharacterUrl) {
      const resolved = await resolveAssetId(diagram.rightCharacterAssetId);
      if (!resolved) {
        throw new Error(`sketchDiagram rightCharacterAssetId "${diagram.rightCharacterAssetId}" was not found in the asset library registry.`);
      }
      diagram.rightCharacterUrl = resolved.imageUrl;
    }
  }

  const pending = sceneDocument.actions.filter((action) => action.imageConcept && !action.imageUrl);

  let imagesGenerated = 0;
  let cacheHits = 0;
  let costUsd = 0;

  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((action) =>
        resolveImage(action.imageConcept!, {
          provider: opts.provider,
          styleVariant: sceneDocument.styleVariant,
          orientation: opts.orientation,
        }).then((generated) => ({ action, generated })),
      ),
    );

    for (const { action, generated } of results) {
      action.imageUrl = generated.imageUrl;
      if (generated.cacheHit) cacheHits++;
      else imagesGenerated++;
      costUsd += generated.costUsd;
    }
  }

  return {
    imagesGenerated,
    cacheHits,
    costUsd,
    provider: pending.length > 0 ? opts.provider.name : undefined,
  };
}
