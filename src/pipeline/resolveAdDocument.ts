import { AdRequestSchema, parseAdDocument, type AdDocument, type AdRequest } from "../schema/ad";
import { planAdFromRequest } from "../schema/adPlanning";

export interface ResolvedAdDocument {
  adDocument: AdDocument;
  adPlanning: { tokensUsed: number; costUsd: number };
}

/**
 * Mirrors resolveSceneDocument's job: validate the raw request, call the
 * planner, and hand back a schema-checked AdDocument. There's only one
 * path here (no pre-authored-beats equivalent yet) — every ad request
 * currently goes through the planner, since a business submitting raw
 * photos + a brief has no way to author beats by hand.
 */
export async function resolveAdDocument(rawRequest: unknown, opts: { apiKey?: string } = {}): Promise<ResolvedAdDocument> {
  const result = AdRequestSchema.safeParse(rawRequest);
  if (!result.success) {
    throw new Error(
      `Invalid ad request: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  const request: AdRequest = result.data;

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
