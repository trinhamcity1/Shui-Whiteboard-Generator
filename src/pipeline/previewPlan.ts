import { planScenesFromScript, type ScenePlanningResult } from "../schema/planning";
import type { SceneAction } from "../schema/scene";

// Mirrors planning.ts's own WORDS_PER_SECOND (~150 wpm) — kept as a
// separate constant here rather than importing a private one, since a
// preview only needs the same estimate the planner already prints, not a
// shared dependency on its internals.
const WORDS_PER_SECOND = 2.5;
const TTS_COST_PER_CHARACTER_USD = 0.00018; // mirrors src/tts/elevenlabs.ts
const IMAGE_COST_PER_LIVE_GENERATION_USD = 0.03; // mirrors src/images/trainedStyle.ts, worst case (no cache/library reuse)
const LAYOUT_QA_COST_PER_COMPOSED_SCENE_USD = 0.002; // observed average across real renders
const RENDER_SECONDS_PER_NARRATION_SECOND = 2.2; // observed ratio across real renders (wall-clock render time per second of video)
const RENDER_COST_PER_WALL_CLOCK_SECOND_USD = 0.00013; // ~2 vCPU + 4GiB Cloud Run estimate, matches src/cost/index.ts's constants

export interface ScenePreviewEntry {
  id: string;
  type: string;
  atSeconds: number;
  durationSeconds: number;
  summary: string;
  illustrated: boolean;
}

export interface ScenePlanPreview {
  narrationScript: string;
  wordCount: number;
  estimatedNarrationSeconds: number;
  scenes: ScenePreviewEntry[];
  illustratedSceneCount: number;
  liveImageGenerationTargets: number; // imageConcept-only; assetId reuse is $0
  composedSceneCount: number; // composition + sketchDiagram, the actions layoutQA checks
  planningCostUsd: number;
  planningTokens: number;
  estimatedTtsCostUsd: number;
  estimatedImageCostUsd: number;
  estimatedLayoutQaCostUsd: number;
  estimatedRenderCostUsd: number;
  estimatedTotalLowUsd: number; // assumes every live image target hits the library/cache instead
  estimatedTotalHighUsd: number; // assumes every live image target is a fresh generation
}

function summarizeAction(action: SceneAction): { summary: string; illustrated: boolean } {
  switch (action.type) {
    case "titleCard":
      return { summary: `titleCard: "${action.text ?? ""}"`, illustrated: false };
    case "bulletList":
      return { summary: `bulletList: ${(action.items ?? []).join(" / ")}`, illustrated: false };
    case "iconCallout":
      return { summary: `iconCallout (${action.icon}): "${action.text ?? ""}"`, illustrated: false };
    case "timeline":
      return { summary: `timeline: ${(action.timelineEntries ?? []).map((e) => e.year).join(", ")}`, illustrated: false };
    case "comparisonCards":
      return { summary: `comparisonCards: ${(action.comparisonCards ?? []).map((c) => c.title).join(" vs ")}`, illustrated: false };
    case "quote":
      return { summary: `quote: "${action.text ?? ""}"${action.attribution ? ` — ${action.attribution}` : ""}`, illustrated: false };
    case "documentReveal":
    case "fullBleedGraphic":
      return {
        summary: `${action.type}: ${action.assetId ? `assetId "${action.assetId}"` : `imageConcept "${action.imageConcept ?? ""}"`}${action.attribution ? ` (caption: "${action.attribution}")` : ""}`,
        illustrated: true,
      };
    case "sketchDiagram": {
      const d = action.sketchDiagram;
      return { summary: `sketchDiagram (${d?.diagramType ?? "pyramid"}): "${d?.title ?? ""}" — ${(d?.tiers ?? []).map((t) => t.label).join(" -> ")}`, illustrated: true };
    }
    case "composition": {
      const c = action.composition;
      const slotSummary = Object.entries(c?.slots ?? {})
        .map(([name, slot]) => `${name}="${slot.label ?? slot.assetId ?? slot.imageConcept ?? ""}"`)
        .join(", ");
      return { summary: `composition (${c?.templateId ?? "?"}): "${c?.title ?? ""}" [${slotSummary}]`, illustrated: true };
    }
    default:
      return { summary: action.type, illustrated: false };
  }
}

function countLiveImageTargets(actions: SceneAction[]): number {
  let count = 0;
  for (const action of actions) {
    if (action.imageConcept && !action.assetId) count++;
    const composition = action.composition;
    if (composition) {
      for (const slot of Object.values(composition.slots)) {
        if (slot.imageConcept && !slot.assetId) count++;
      }
    }
  }
  return count;
}

/**
 * Runs only the real planning call (the cheap, fast step) and stops there
 * — no TTS, no image generation, no render. Lets a caller see exactly what
 * would get produced (transcript, scene-by-scene breakdown, a cost
 * estimate range) before committing to the expensive steps. The only real
 * money spent is the one Sonnet/Haiku planning call itself.
 */
export async function previewScenePlan(
  narrationScript: string,
  opts: { apiKey?: string; model?: string } = {},
): Promise<ScenePlanPreview> {
  const planResult: ScenePlanningResult = await planScenesFromScript(narrationScript, opts);

  const wordCount = narrationScript.trim().split(/\s+/).filter(Boolean).length;
  const estimatedNarrationSeconds = Math.max(3, wordCount / WORDS_PER_SECOND);

  const scenes: ScenePreviewEntry[] = planResult.actions.map((action) => {
    const { summary, illustrated } = summarizeAction(action);
    return { id: action.id, type: action.type, atSeconds: action.atSeconds, durationSeconds: action.durationSeconds, summary, illustrated };
  });

  const illustratedSceneCount = scenes.filter((s) => s.illustrated).length;
  const liveImageGenerationTargets = countLiveImageTargets(planResult.actions);
  const composedSceneCount = planResult.actions.filter((a) => a.type === "composition" || a.type === "sketchDiagram").length;

  const estimatedTtsCostUsd = narrationScript.length * TTS_COST_PER_CHARACTER_USD;
  const estimatedImageCostUsd = liveImageGenerationTargets * IMAGE_COST_PER_LIVE_GENERATION_USD;
  const estimatedLayoutQaCostUsd = composedSceneCount * LAYOUT_QA_COST_PER_COMPOSED_SCENE_USD;
  const estimatedRenderWallClockSeconds = estimatedNarrationSeconds * RENDER_SECONDS_PER_NARRATION_SECOND;
  const estimatedRenderCostUsd = estimatedRenderWallClockSeconds * RENDER_COST_PER_WALL_CLOCK_SECOND_USD;

  const fixedCosts = planResult.costUsd + estimatedTtsCostUsd + estimatedLayoutQaCostUsd + estimatedRenderCostUsd;

  return {
    narrationScript,
    wordCount,
    estimatedNarrationSeconds,
    scenes,
    illustratedSceneCount,
    liveImageGenerationTargets,
    composedSceneCount,
    planningCostUsd: planResult.costUsd,
    planningTokens: planResult.tokensUsed,
    estimatedTtsCostUsd,
    estimatedImageCostUsd,
    estimatedLayoutQaCostUsd,
    estimatedRenderCostUsd,
    estimatedTotalLowUsd: fixedCosts, // every live image target reused from the library/cache instead of freshly generated
    estimatedTotalHighUsd: fixedCosts + estimatedImageCostUsd,
  };
}

export function printScenePlanPreview(preview: ScenePlanPreview): void {
  console.log("\n=== SCRIPT ===");
  console.log(preview.narrationScript);

  console.log("\n=== SCENE PLAN ===");
  for (const scene of preview.scenes) {
    const mark = scene.illustrated ? "🖼 " : "   ";
    console.log(`${mark}${scene.atSeconds.toFixed(1).padStart(5)}s +${scene.durationSeconds.toFixed(1)}s [${scene.type}] ${scene.id}`);
    console.log(`      ${scene.summary}`);
  }

  const perMinLow = preview.estimatedTotalLowUsd / (preview.estimatedNarrationSeconds / 60);
  const perMinHigh = preview.estimatedTotalHighUsd / (preview.estimatedNarrationSeconds / 60);

  console.log("\n=== ESTIMATE ===");
  console.log(`Word count:          ${preview.wordCount}`);
  console.log(`Estimated duration:  ${preview.estimatedNarrationSeconds.toFixed(1)}s (~${(preview.estimatedNarrationSeconds / 60).toFixed(2)} min)`);
  console.log(`Scenes:              ${preview.scenes.length} total, ${preview.illustratedSceneCount} illustrated`);
  console.log(`Live image gens:     ${preview.liveImageGenerationTargets} (worst case — fewer if the library/cache reuses any)`);
  console.log(`Planning (actual):   ${preview.planningTokens} tokens -> $${preview.planningCostUsd.toFixed(4)} (already spent, real)`);
  console.log(`TTS (estimate):      $${preview.estimatedTtsCostUsd.toFixed(4)}`);
  console.log(`Images (estimate):   $0.0000 - $${preview.estimatedImageCostUsd.toFixed(4)}`);
  console.log(`LayoutQA (estimate): $${preview.estimatedLayoutQaCostUsd.toFixed(4)}`);
  console.log(`Render (estimate):   $${preview.estimatedRenderCostUsd.toFixed(4)}`);
  console.log(`TOTAL (estimate):    $${preview.estimatedTotalLowUsd.toFixed(4)} - $${preview.estimatedTotalHighUsd.toFixed(4)}`);
  console.log(`Per minute:          $${perMinLow.toFixed(3)} - $${perMinHigh.toFixed(3)}/min`);
  console.log("(Only the Planning line above is real spend — everything else is a pre-render estimate.)\n");
}
