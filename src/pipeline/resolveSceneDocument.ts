import { z } from "zod";
import { SceneDocument, parseSceneDocument, SceneValidationError } from "../schema/scene";
import { planScenesFromScript } from "../schema/planning";
import { writeScriptFromTopic } from "../schema/scriptWriting";
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

/** The "advanced" input tier: no script at all, just a topic — expanded
 * into a full narrationScript by writeScriptFromTopic before the request
 * is otherwise handled exactly like ScriptOnlyRequest. */
export interface TopicRequest {
  topic: string;
  targetDurationSeconds?: number;
  voice: string;
  styleVariant: string;
  orientation?: "vertical" | "horizontal";
  backgroundTrack?: string;
  imageProvider?: ImageProviderName;
}

export type SceneDocumentRequest = PreAuthoredRequest | ScriptOnlyRequest | TopicRequest;

const SharedScriptFields = {
  voice: z.string().min(1),
  styleVariant: z.string().min(1),
  orientation: z.enum(["vertical", "horizontal"]).optional(),
  backgroundTrack: z.string().optional(),
  imageProvider: z.enum(["recraft", "flux", "trained-style"]).optional(),
};

export const ScriptOnlyRequestSchema = z
  .object({
    narrationScript: z.string().min(1),
    ...SharedScriptFields,
  })
  .strict();

export const TopicRequestSchema = z
  .object({
    topic: z.string().min(1),
    targetDurationSeconds: z.number().positive().optional(),
    ...SharedScriptFields,
  })
  .strict();

export interface ResolvedSceneDocument {
  sceneDocument: SceneDocument;
  scriptWriting?: { tokensUsed: number; costUsd: number };
  scenePlanning?: { tokensUsed: number; costUsd: number };
  imageResolution?: ImageResolutionResult;
}

function isPreAuthored(request: SceneDocumentRequest): request is PreAuthoredRequest {
  return "scenes" in request;
}

function isTopicRequest(request: SceneDocumentRequest): request is TopicRequest {
  return "topic" in request && request.topic !== undefined;
}

function needsImageResolution(sceneDocument: SceneDocument): boolean {
  return sceneDocument.actions.some((action) => {
    if (action.imageConcept && !action.imageUrl) return true;
    if (action.assetId && !action.imageUrl) return true;
    const diagram = action.sketchDiagram;
    if (diagram) {
      if (diagram.leftCharacterAssetId && !diagram.leftCharacterUrl) return true;
      if (diagram.rightCharacterAssetId && !diagram.rightCharacterUrl) return true;
      if (diagram.tiers.some((tier) => tier.insetAssetId && !tier.insetImageUrl)) return true;
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
 * Mirrors Golpo's `prompt` vs `custom_script` split, extended with a third
 * tier: a caller supplies a full pre-authored SceneDocument, a narration
 * script that gets planned into one via the scene-planning LLM call, or
 * just a topic that first gets expanded into a narration script (the
 * script-writing LLM call) before being handed to that same planner.
 * Rejects a request that supplies none or more than one of these — the
 * request must pick exactly one tier.
 *
 * Async because every path but the pre-authored one makes a real LLM call
 * (the topic path makes two), and any path may make real image-generation
 * calls (Phase 4) for an action with an imageConcept — callers on a
 * request/response path that must return immediately (the API's `generate`
 * route) should validate shape with ScriptOnlyRequestSchema/
 * TopicRequestSchema instead and defer calling this until the async render
 * worker.
 */
export async function resolveSceneDocument(request: SceneDocumentRequest): Promise<ResolvedSceneDocument> {
  const hasScenes = "scenes" in request && request.scenes !== undefined;
  const hasScript = "narrationScript" in request && request.narrationScript !== undefined;
  const hasTopic = isTopicRequest(request);

  const modesSupplied = [hasScenes, hasScript, hasTopic].filter(Boolean).length;
  if (modesSupplied > 1) {
    throw new Error("Request must supply exactly one of `scenes`, `narrationScript`, or `topic`, not more than one.");
  }
  if (modesSupplied === 0) {
    throw new Error(
      "Request must supply one of `scenes` (pre-authored), `narrationScript` (script-only), or `topic` (topic-only).",
    );
  }

  if (isPreAuthored(request)) {
    const sceneDocument = parseSceneDocument(request.scenes);
    const imageResolution = await resolveImagesIfNeeded(sceneDocument, request.imageProvider);
    return { sceneDocument, imageResolution };
  }

  let narrationScript: string;
  let scriptWriting: { tokensUsed: number; costUsd: number } | undefined;
  let scriptRequest: z.infer<typeof ScriptOnlyRequestSchema> | z.infer<typeof TopicRequestSchema>;

  if (hasTopic) {
    const topicResult = TopicRequestSchema.safeParse(request);
    if (!topicResult.success) {
      throw new SceneValidationError(
        topicResult.error.issues.map((issue) => ({ loc: issue.path, msg: issue.message })),
      );
    }
    scriptRequest = topicResult.data;
    const writingResult = await writeScriptFromTopic(topicResult.data.topic, {
      targetDurationSeconds: topicResult.data.targetDurationSeconds,
    });
    narrationScript = writingResult.narrationScript;
    scriptWriting = { tokensUsed: writingResult.tokensUsed, costUsd: writingResult.costUsd };
  } else {
    const scriptResult = ScriptOnlyRequestSchema.safeParse(request);
    if (!scriptResult.success) {
      throw new SceneValidationError(
        scriptResult.error.issues.map((issue) => ({ loc: issue.path, msg: issue.message })),
      );
    }
    scriptRequest = scriptResult.data;
    narrationScript = scriptResult.data.narrationScript;
  }

  const planResult = await planScenesFromScript(narrationScript);

  const sceneDocument = parseSceneDocument({
    schemaVersion: 1,
    narrationScript,
    voice: scriptRequest.voice,
    styleVariant: scriptRequest.styleVariant,
    orientation: scriptRequest.orientation ?? "vertical",
    backgroundTrack: scriptRequest.backgroundTrack,
    actions: planResult.actions,
  });

  const imageResolution = await resolveImagesIfNeeded(sceneDocument, scriptRequest.imageProvider);

  return {
    sceneDocument,
    scriptWriting,
    scenePlanning: { tokensUsed: planResult.tokensUsed, costUsd: planResult.costUsd },
    imageResolution,
  };
}
