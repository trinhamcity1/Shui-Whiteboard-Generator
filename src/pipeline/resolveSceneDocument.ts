import { SceneDocument, parseSceneDocument, type SceneAction } from "../schema/scene";
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

function isPreAuthored(request: SceneDocumentRequest): request is PreAuthoredRequest {
  return "scenes" in request;
}

/**
 * Mirrors Golpo's `prompt` vs `custom_script` split: a caller supplies
 * either a full pre-authored SceneDocument, or just a narration script
 * that gets planned into one. Rejects a request that is neither or both —
 * ambiguous input should fail loudly, not guess.
 */
export function resolveSceneDocument(request: SceneDocumentRequest): SceneDocument {
  const hasScenes = "scenes" in request && request.scenes !== undefined;
  const hasScript = "narrationScript" in request && request.narrationScript !== undefined;

  if (hasScenes && hasScript) {
    throw new Error("Request must supply either `scenes` or `narrationScript`, not both.");
  }
  if (!hasScenes && !hasScript) {
    throw new Error("Request must supply either `scenes` (pre-authored) or `narrationScript` (script-only).");
  }

  if (isPreAuthored(request)) {
    return parseSceneDocument(request.scenes);
  }

  const scriptRequest = request as ScriptOnlyRequest;
  const actions: SceneAction[] = planScenesFromScript(scriptRequest.narrationScript);

  return parseSceneDocument({
    schemaVersion: 1,
    narrationScript: scriptRequest.narrationScript,
    voice: scriptRequest.voice,
    styleVariant: scriptRequest.styleVariant,
    orientation: scriptRequest.orientation ?? "vertical",
    backgroundTrack: scriptRequest.backgroundTrack,
    actions,
  });
}
