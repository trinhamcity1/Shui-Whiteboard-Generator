import path from "node:path";
import fs from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { ElevenLabsTTSProvider } from "../tts/elevenlabs";
import { buildJobCost, type JobCost } from "../cost/index";
import { checkSceneTiming } from "../render/timing";
import { uploadRenderToR2 } from "../storage/r2";
import { resolveSceneDocument, type SceneDocumentRequest } from "./resolveSceneDocument";
import type { SceneInputProps } from "../render/Root";

export interface RenderJobResult {
  outputLocation: string;
  jobCost: JobCost;
  timingWarnings: string[];
  uploadUrl?: string;
  uploadError?: string;
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
}): Promise<RenderJobResult> {
  const { sceneDocument, scenePlanning, imageResolution } = await resolveSceneDocument(args.request);

  const tts = new ElevenLabsTTSProvider(args.apiKey);
  const ttsResult = await tts.synthesize(sceneDocument.narrationScript, { voice: sceneDocument.voice });

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

  const renderStart = Date.now();
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "SceneRenderer",
    inputProps,
  });
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
  });

  return {
    outputLocation: args.outputLocation,
    jobCost,
    timingWarnings: timingResult.warnings,
    uploadUrl,
    uploadError,
  };
}
