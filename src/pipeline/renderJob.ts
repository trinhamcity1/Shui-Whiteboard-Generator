import path from "node:path";
import fs from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { ElevenLabsTTSProvider } from "../tts/elevenlabs";
import { buildJobCost, type JobCost } from "../cost/index";
import { checkSceneTiming, realignSceneTiming } from "../render/timing";
import { uploadRenderToR2 } from "../storage/r2";
import { resolveSceneDocument, type SceneDocumentRequest } from "./resolveSceneDocument";
import { inlineRemoteImagesForLocalDev } from "./localDevInlining";
import { runLayoutQA, type LayoutQALogEntry } from "./layoutQA";
import { promotePendingAssets } from "../images/assetLibrary/promote";
import type { SceneInputProps } from "../render/Root";

export interface RenderJobResult {
  outputLocation: string;
  jobCost: JobCost;
  timingWarnings: string[];
  uploadUrl?: string;
  uploadError?: string;
  sceneDocumentDebug?: unknown;
  layoutQaLog?: LayoutQALogEntry[];
  assetPromotionLog?: string[];
}

/**
 * Runs one job through the full Phase 1 pipeline: resolve + validate the
 * SceneDocument, synthesize narration, check timing drift, render, upload.
 *
 * Bundles fresh on every call, *after* the narration audio is written to
 * public/ — Remotion's bundle() snapshots public/ into its own temp dir at
 * call time, so bundling before the audio file exists serves a stale
 * snapshot that 404s on the audio it doesn't know about yet.
 */
export async function renderSceneDocumentJob(args: {
  request: SceneDocumentRequest;
  apiKey: string;
  rootDir: string;
  outputLocation: string;
  uploadKey: string;
  audioFileName?: string;
  /** See localDevInlining.ts — opt-in workaround for this sandbox only, never set in production. */
  inlineImagesForLocalDev?: boolean;
  /** Revision-3 Workstream 4 — runs the vision-LLM layout QA pass over every composed scene before the final render. Opt-in until validated against enough real renders to flip the default. */
  enableLayoutQA?: boolean;
}): Promise<RenderJobResult> {
  const { sceneDocument, scenePlanning, imageResolution } = await resolveSceneDocument(args.request);

  if (args.inlineImagesForLocalDev) {
    await inlineRemoteImagesForLocalDev(sceneDocument);
  }

  const tts = new ElevenLabsTTSProvider(args.apiKey);
  const ttsResult = await tts.synthesize(sceneDocument.narrationScript, { voice: sceneDocument.voice });

  // Snaps every action's timing from the planner's pre-TTS estimate onto
  // the real per-word timestamps ElevenLabs just returned — see
  // realignSceneTiming's own comment for why the estimate drifts and what
  // this fixes. Runs before checkSceneTiming so the warning below reflects
  // genuine remaining drift, not the (now corrected) estimate-vs-real gap.
  realignSceneTiming(sceneDocument, ttsResult.wordTimings);

  const timingResult = checkSceneTiming(sceneDocument, ttsResult.durationSeconds);

  const publicDir = path.join(args.rootDir, "public");
  await fs.mkdir(publicDir, { recursive: true });
  const audioFileName = args.audioFileName ?? `tts-audio-${Date.now()}.mp3`;
  await fs.writeFile(path.join(publicDir, audioFileName), ttsResult.audioBuffer);

  const bundleLocation = await bundle({
    entryPoint: path.join(args.rootDir, "src/render/index.ts"),
    publicDir,
  });

  const totalDurationSeconds = Math.max(timingResult.sceneEndSeconds, ttsResult.durationSeconds) + 1;
  const inputProps: SceneInputProps = { sceneDocument, audioFileName, totalDurationSeconds };

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "SceneRenderer",
    inputProps,
  });

  let layoutQaLog: LayoutQALogEntry[] | undefined;
  if (args.enableLayoutQA) {
    layoutQaLog = await runLayoutQA({
      sceneDocument,
      bundleLocation,
      composition,
      inputProps,
      fps: composition.fps,
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  const renderStart = Date.now();
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: args.outputLocation,
    inputProps,
  });
  const renderWallClockSeconds = (Date.now() - renderStart) / 1000;

  let uploadUrl: string | undefined;
  let uploadError: string | undefined;
  try {
    const { url } = await uploadRenderToR2({ localFilePath: args.outputLocation, key: args.uploadKey });
    uploadUrl = url;
  } catch (err) {
    uploadError = (err as Error).message;
  }

  // Only worth the sweep when this job actually generated a new asset —
  // a pre-authored SceneDocument or an all-cache-hit video adds nothing
  // to review. Runs after the video is already rendered/uploaded so a
  // promotion failure can never cost the user their finished video; the
  // whole thing is wrapped defensively for the same reason. Sweeps every
  // pending asset in the library, not just this job's own — cheap (a
  // fraction of a cent per asset) and it's how a public-facing version of
  // this app would keep the shared library current from real usage
  // instead of needing someone to run this by hand.
  let assetPromotionCostUsd: number | undefined;
  let assetPromotionLog: string[] | undefined;
  if ((imageResolution?.imagesGenerated ?? 0) > 0) {
    try {
      const promotion = await promotePendingAssets({ apiKey: process.env.ANTHROPIC_API_KEY });
      assetPromotionCostUsd = promotion.costUsd;
      assetPromotionLog = promotion.log;
    } catch (err) {
      assetPromotionLog = [`Asset promotion sweep failed: ${(err as Error).message}`];
    }
  }

  const jobCost = buildJobCost({
    ttsCharacters: ttsResult.characters,
    ttsCostUsd: ttsResult.costUsd,
    renderWallClockSeconds,
    scenePlanningLLMTokens: scenePlanning?.tokensUsed,
    scenePlanningCostUsd: scenePlanning?.costUsd,
    imagesGenerated: imageResolution?.imagesGenerated,
    imageCacheHits: imageResolution?.cacheHits,
    imageGenerationCostUsd: imageResolution?.costUsd,
    imageProvider: imageResolution?.provider,
    layoutQaCostUsd: layoutQaLog?.reduce((sum, entry) => sum + entry.costUsd, 0),
    assetPromotionCostUsd,
  });

  return {
    outputLocation: args.outputLocation,
    jobCost,
    timingWarnings: timingResult.warnings,
    uploadUrl,
    uploadError,
    sceneDocumentDebug: sceneDocument,
    layoutQaLog,
    assetPromotionLog,
  };
}
