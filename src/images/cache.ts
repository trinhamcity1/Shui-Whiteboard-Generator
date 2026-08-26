import crypto from "node:crypto";
import type { GeneratedImage, ImageProvider } from "./types";
import { TrainedStyleImageProvider, TRAINED_STYLE_PROMPT_VERSION } from "./trainedStyle";
import { uploadBufferToR2, getPresignedUrlForKey } from "../storage/r2";
import {
  getImageCacheEntry,
  createImageCacheEntry,
  incrementImageCacheHit,
  isFirestoreKnownUnreachable,
  markFirestoreUnreachable,
} from "../storage/firestore";

export function cacheKeyFor(provider: string, styleVariant: string, concept: string): string {
  const normalized = concept.trim().toLowerCase();
  return crypto.createHash("sha256").update(`${provider}:${styleVariant}:${normalized}`).digest("hex");
}

/** provider.name is the fixed literal "trained-style" for EVERY trained
 * LoRA (the shared default model and every customer's private Echo
 * model alike) — cacheKeyFor alone would let two different models
 * collide on the same concept text. Folding in the trigger word (unique
 * per model, since echoPipeline.ts mints one per Echo model) keeps their
 * cache entries — and therefore their images — from ever mixing. Also
 * folds in TRAINED_STYLE_PROMPT_VERSION, so editing the prompt wording
 * around the concept (not the model itself) invalidates old cache entries
 * too — see that constant's own comment for the real render this fixed. */
export function cacheProviderDiscriminator(provider: ImageProvider): string {
  return provider instanceof TrainedStyleImageProvider
    ? `${provider.name}:${provider.styleModel.triggerWord}:${TRAINED_STYLE_PROMPT_VERSION}`
    : provider.name;
}

function extensionFor(contentType: string): string {
  return contentType.includes("svg") ? "svg" : "png";
}

/**
 * Resolves one imageConcept to a real image, cache-first. Image generation
 * is the expensive, slow step in this pipeline — most whiteboard videos on
 * related topics reuse similar concepts, so this cache is what keeps the
 * pipeline anywhere near its target cost, not an optional optimization.
 */
export async function resolveImage(
  concept: string,
  opts: { provider: ImageProvider; styleVariant: string; orientation: "vertical" | "horizontal" },
): Promise<GeneratedImage> {
  const cacheKey = cacheKeyFor(cacheProviderDiscriminator(opts.provider), opts.styleVariant, concept);

  // Same fallback discipline as the asset library (registryLookup.ts):
  // without real GCP credentials this cache is unreachable, so skip
  // straight to a live generation instead of attempting (and racing) a
  // real Firestore call — every concept generates fresh, which is
  // correct behavior for a dev/sandbox environment without persistence.
  if (!isFirestoreKnownUnreachable()) {
    try {
      const cached = await getImageCacheEntry(cacheKey);
      if (cached) {
        await incrementImageCacheHit(cacheKey);
        const imageUrl = await getPresignedUrlForKey({ key: cached.r2Key });
        return {
          imageUrl,
          provider: opts.provider.name,
          costUsd: 0,
          cacheHit: true,
          widthPx: cached.widthPx,
          heightPx: cached.heightPx,
        };
      }
    } catch {
      markFirestoreUnreachable();
    }
  }

  const raw = await opts.provider.generate(concept, { styleVariant: opts.styleVariant, orientation: opts.orientation });
  const r2Key = `images/${cacheKey}.${extensionFor(raw.contentType)}`;
  const { url } = await uploadBufferToR2({ buffer: raw.imageBuffer, key: r2Key, contentType: raw.contentType });

  if (!isFirestoreKnownUnreachable()) {
    try {
      await createImageCacheEntry(cacheKey, {
        provider: opts.provider.name,
        styleVariant: opts.styleVariant,
        concept,
        r2Key,
        widthPx: raw.widthPx,
        heightPx: raw.heightPx,
        costUsd: raw.costUsd,
        createdAt: Date.now(),
        hitCount: 0,
      });
    } catch {
      markFirestoreUnreachable();
    }
  }

  return {
    imageUrl: url,
    provider: opts.provider.name,
    costUsd: raw.costUsd,
    cacheHit: false,
    widthPx: raw.widthPx,
    heightPx: raw.heightPx,
  };
}
