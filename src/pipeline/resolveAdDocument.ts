import { AdRequestSchema, parseAdDocument, type AdDocument, type AdRequest } from "../schema/ad";
import { planAdFromRequest } from "../schema/adPlanning";
import { getAdAsset, isFirestoreKnownUnreachable } from "../storage/firestore";
import { getLocalAdAsset } from "../storage/localAdAssets";

export interface ResolvedAdDocument {
  adDocument: AdDocument;
  adPlanning: { tokensUsed: number; costUsd: number };
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
    platform: request.platform,
    voice: request.voice,
    durationSeconds: planned.durationSeconds,
    targetAudience: planned.targetAudience,
    suggestedAudiences: planned.suggestedAudiences,
    productImages: request.productImages,
    beats: planned.beats,
  });

  return { adDocument, adPlanning: { tokensUsed: planned.tokensUsed, costUsd: planned.costUsd } };
}
