import type { SceneDocument } from "../schema/scene";
import type { ImageProvider, ImageProviderName } from "./types";
import { resolveImage } from "./cache";

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
