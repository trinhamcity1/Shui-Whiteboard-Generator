import { z } from "zod";
import { SceneDocument, parseSceneDocument, SceneValidationError } from "../schema/scene";
import { planScenesFromScript } from "../schema/planning";
import { getImageProvider, defaultImageProviderName, type ImageProviderName } from "../images/index";
import { resolveImages, type ImageResolutionResult } from "../images/resolveImages";

export interface PreAuthoredRequest {
  scenes: unknown; // validated against SceneDocument below
  imageProvider?: ImageProviderName;
}

export interface ScriptOnlyRequest {
  narrationScript: string;
  voice: string;
  styleVariant: string;
  orientation?: "vertical" | "horizontal";
  backgroundTrack?: string;
  imageProvider?: ImageProviderName;
}

export type SceneDocumentRequest = PreAuthoredRequest | ScriptOnlyRequest;

export const ScriptOnlyRequestSchema = z
  .object({
    narrationScript: z.string().min(1),
    voice: z.string().min(1),
    styleVariant: z.string().min(1),
    orientation: z.enum(["vertical", "horizontal"]).optional(),
    backgroundTrack: z.string().optional(),
    imageProvider: z.enum(["recraft", "flux", "trained-style"]).optional(),
  })
  .strict();

export interface ResolvedSceneDocument {
  sceneDocument: SceneDocument;
  scenePlanning?: { tokensUsed: number; costUsd: number };
  imageResolution?: ImageResolutionResult;
}

function isPreAuthored(request: SceneDocumentRequest): request is PreAuthoredRequest {
  return "scenes" in request;
}

function needsImageResolution(sceneDocument: SceneDocument): boolean {
  return sceneDocument.actions.some((action) => {
    if (action.imageConcept && !action.imageUrl) return true;
    if (action.assetId && !action.imageUrl) return true;
    const diagram = action.sketchDiagram;
    if (diagram) {
      if (diagram.leftCharacterAssetId && !diagram.leftCharacterUrl) return true;
      if (diagram.rightCharacterAssetId && !diagram.rightCharacterUrl) return true;
    }
    const composition = action.composition;
    if (composition) {
      return Object.values(composition.slots).some(
        (slot) => (slot.assetId || slot.imageConcept) && !slot.imageUrl,
      );
    }
    return false;
  });
}

async function resolveImagesIfNeeded(
  sceneDocument: SceneDocument,
  imageProvider: ImageProviderName | undefined,
): Promise<ImageResolutionResult | undefined> {
  if (!needsImageResolution(sceneDocument)) return undefined;

  // getImageProvider throws if the API key for the *live* provider isn't
  // configured — irrelevant when every pending action resolves via the
  // $0 asset registry lookup and none need live generation.
  const needsLiveProvider = sceneDocument.actions.some(
    (action) =>
      (action.imageConcept && !action.imageUrl) ||
      (action.composition && Object.values(action.composition.slots).some((slot) => slot.imageConcept && !slot.imageUrl)),
  );
  const provider = needsLiveProvider ? getImageProvider(imageProvider ?? defaultImageProviderName()) : undefined;
  return resolveImages(sceneDocument, { provider, orientation: sceneDocument.orientation });
}

/**
 * Mirrors Golpo's `prompt` vs `custom_script` split: a caller supplies
 * either a full pre-authored SceneDocument, or just a narration script
 * that gets planned into one via Phase 3's LLM call. Rejects a request
 * that is neither or both — ambiguous input should fail loudly, not
 * guess.
 *
 * Async because the script-only path makes a real LLM call, and either
 * path may make real image-generation calls (Phase 4) for any action with
 * an imageConcept — callers on a request/response path that must return
 * immediately (the API's `generate` route) should validate shape with
 * ScriptOnlyRequestSchema instead and defer calling this until the async
 * render worker.
 */
export async function resolveSceneDocument(request: SceneDocumentRequest): Promise<ResolvedSceneDocument> {
  const hasScenes = "scenes" in request && request.scenes !== undefined;
  const hasScript = "narrationScript" in request && request.narrationScript !== undefined;

  if (hasScenes && hasScript) {
    throw new Error("Request must supply either `scenes` or `narrationScript`, not both.");
  }
  if (!hasScenes && !hasScript) {
    throw new Error("Request must supply either `scenes` (pre-authored) or `narrationScript` (script-only).");
  }

  if (isPreAuthored(request)) {
    const sceneDocument = parseSceneDocument(request.scenes);
    const imageResolution = await resolveImagesIfNeeded(sceneDocument, request.imageProvider);
    return { sceneDocument, imageResolution };
  }

  const scriptResult = ScriptOnlyRequestSchema.safeParse(request);
  if (!scriptResult.success) {
    throw new SceneValidationError(
      scriptResult.error.issues.map((issue) => ({ loc: issue.path, msg: issue.message })),
    );
  }
  const scriptRequest = scriptResult.data;

  const planResult = await planScenesFromScript(scriptRequest.narrationScript);

  const sceneDocument = parseSceneDocument({
    schemaVersion: 1,
    narrationScript: scriptRequest.narrationScript,
    voice: scriptRequest.voice,
    styleVariant: scriptRequest.styleVariant,
    orientation: scriptRequest.orientation ?? "vertical",
    backgroundTrack: scriptRequest.backgroundTrack,
    actions: planResult.actions,
  });

  const imageResolution = await resolveImagesIfNeeded(sceneDocument, scriptRequest.imageProvider);

  return {
    sceneDocument,
    scenePlanning: { tokensUsed: planResult.tokensUsed, costUsd: planResult.costUsd },
    imageResolution,
  };
}
