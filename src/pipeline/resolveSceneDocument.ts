import { z } from "zod";
import { SceneDocument, parseSceneDocument, SceneValidationError } from "../schema/scene";
import { planScenesFromScript } from "../schema/planning";

export interface PreAuthoredRequest {
  scenes: unknown; // validated against SceneDocument below
}

export interface ScriptOnlyRequest {
  narrationScript: string;
  voice: string;
  styleVariant: string;
  orientation?: "vertical" | "horizontal";
  backgroundTrack?: string;
}

export type SceneDocumentRequest = PreAuthoredRequest | ScriptOnlyRequest;

export const ScriptOnlyRequestSchema = z
  .object({
    narrationScript: z.string().min(1),
    voice: z.string().min(1),
    styleVariant: z.string().min(1),
    orientation: z.enum(["vertical", "horizontal"]).optional(),
    backgroundTrack: z.string().optional(),
  })
  .strict();

export interface ResolvedSceneDocument {
  sceneDocument: SceneDocument;
  scenePlanning?: { tokensUsed: number; costUsd: number };
}

function isPreAuthored(request: SceneDocumentRequest): request is PreAuthoredRequest {
  return "scenes" in request;
}

/**
 * Mirrors Golpo's `prompt` vs `custom_script` split: a caller supplies
 * either a full pre-authored SceneDocument, or just a narration script
 * that gets planned into one via Phase 3's LLM call. Rejects a request
 * that is neither or both — ambiguous input should fail loudly, not
 * guess.
 *
 * Async because the script-only path makes a real LLM call — callers on
 * a request/response path that must return immediately (the API's
 * `generate` route) should validate shape with ScriptOnlyRequestSchema
 * instead and defer calling this until the async render worker.
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
    return { sceneDocument: parseSceneDocument(request.scenes) };
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

  return {
    sceneDocument,
    scenePlanning: { tokensUsed: planResult.tokensUsed, costUsd: planResult.costUsd },
  };
}
