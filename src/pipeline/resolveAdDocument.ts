import { AdRequestSchema, parseAdDocument, type AdDocument, type AdRequest } from "../schema/ad";
import { planAdFromRequest } from "../schema/adPlanning";
import { getAdAsset, isFirestoreKnownUnreachable } from "../storage/firestore";
import { getLocalAdAsset } from "../storage/localAdAssets";
import { removeBackgroundViaFal } from "../images/backgroundRemoval";
import { uploadBufferToR2 } from "../storage/r2";

export interface ResolvedAdDocument {
  adDocument: AdDocument;
  adPlanning: { tokensUsed: number; costUsd: number };
  backgroundRemoval: { imagesProcessed: number; costUsd: number };
}

/**
 * kinetic-hero beats reference a product photo by index but need a
 * background-removed cutout to actually composite as a floating hero
 * object — the planner only ever picks WHICH photo (see adPlanning.ts),
 * never a URL, so that cutout has to be produced here, after planning,
 * the same "planner requests an operation, a resolve step fills the real
 * URL" discipline resolveImages.ts already uses for the whiteboard path.
 * Cached per distinct productImageIndex within one document — a plan that
 * reuses the same photo across multiple kinetic-hero beats only pays for
 * one real background-removal call, not one per beat.
 */
async function resolveKineticHeroCutouts(
  adDocument: AdDocument,
  falApiKey: string | undefined,
): Promise<{ imagesProcessed: number; costUsd: number }> {
  const needsCutout = adDocument.beats.some((b) => b.kineticHero && !b.kineticHero.cutoutUrl);
  if (!needsCutout) return { imagesProcessed: 0, costUsd: 0 };
  if (!falApiKey) throw new Error("FLUX_API_KEY is not set — required for kinetic-hero background removal.");

  const cutoutUrlByIndex = new Map<number, string>();
  let costUsd = 0;

  for (const beat of adDocument.beats) {
    if (!beat.kineticHero || beat.kineticHero.cutoutUrl) continue;
    const index = beat.kineticHero.productImageIndex;

    let cutoutUrl = cutoutUrlByIndex.get(index);
    if (!cutoutUrl) {
      const sourceUrl = adDocument.productImages[index]!.url;
      const removed = await removeBackgroundViaFal(sourceUrl, falApiKey);
      costUsd += removed.costUsd;
      const { url } = await uploadBufferToR2({
        buffer: removed.imageBuffer,
        key: `ads/cutouts/${index}-${Date.now()}.png`,
        contentType: "image/png",
      });
      cutoutUrl = url;
      cutoutUrlByIndex.set(index, cutoutUrl);
    }
    beat.kineticHero.cutoutUrl = cutoutUrl;
  }

  return { imagesProcessed: cutoutUrlByIndex.size, costUsd };
}

/**
 * A productImages entry may reference an uploaded asset by id instead of
 * a raw url (see assetsRouter/ProductImageRef) — resolved here, against
 * the job's OWNING api key, not whichever key happens to be making this
 * particular call. Throws on a missing or not-owned asset rather than
 * silently falling through, since serving another account's private
 * upload back as a resolved url would be a real ownership bug, not a
 * schema nicety.
 */
export async function resolveProductImageUrls(
  request: AdRequest,
  ownerApiKeyId: string,
): Promise<Array<{ url: string; label?: string }>> {
  return Promise.all(
    request.productImages.map(async (img) => {
      if ("url" in img) return { url: img.url, label: img.label };

      const asset = isFirestoreKnownUnreachable() ? getLocalAdAsset(img.assetId) : await getAdAsset(img.assetId);
      if (!asset) throw new Error(`Referenced product image assetId "${img.assetId}" was not found.`);
      if (asset.apiKeyId !== ownerApiKeyId) throw new Error(`Referenced product image assetId "${img.assetId}" is not owned by this account.`);
      return { url: asset.url, label: img.label ?? asset.label };
    }),
  );
}

/**
 * Mirrors resolveSceneDocument's job: validate the raw request, resolve
 * any uploaded-asset references, call the planner, and hand back a
 * schema-checked AdDocument. There's only one path here (no pre-authored-
 * beats equivalent yet) — every ad request currently goes through the
 * planner, since a business submitting raw photos + a brief has no way to
 * author beats by hand.
 */
export async function resolveAdDocument(
  rawRequest: unknown,
  ownerApiKeyId: string,
  opts: { apiKey?: string } = {},
): Promise<ResolvedAdDocument> {
  const result = AdRequestSchema.safeParse(rawRequest);
  if (!result.success) {
    throw new Error(
      `Invalid ad request: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  const request: AdRequest = { ...result.data, productImages: await resolveProductImageUrls(result.data, ownerApiKeyId) };

  const planned = await planAdFromRequest(request, { apiKey: opts.apiKey });

  const adDocument = parseAdDocument({
    schemaVersion: 2,
    templateId: planned.templateId,
    visualStyle: planned.visualStyle,
    platform: request.platform,
    voice: request.voice,
    durationSeconds: planned.durationSeconds,
    targetAudience: planned.targetAudience,
    suggestedAudiences: planned.suggestedAudiences,
    productImages: request.productImages,
    beats: planned.beats,
  });

  const backgroundRemoval = await resolveKineticHeroCutouts(adDocument, process.env.FLUX_API_KEY);

  return { adDocument, adPlanning: { tokensUsed: planned.tokensUsed, costUsd: planned.costUsd }, backgroundRemoval };
}
