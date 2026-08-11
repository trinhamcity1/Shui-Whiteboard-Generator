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

export async function bundleRenderer(entryPointDir: string): Promise<{ bundleLocation: string; publicDir: string }> {
  const publicDir = path.join(entryPointDir, "public");
  await fs.mkdir(publicDir, { recursive: true });
  const bundleLocation = await bundle({
    entryPoint: path.join(entryPointDir, "src/render/index.ts"),
    publicDir,
  });
  return { bundleLocation, publicDir };
}

/**
 * Runs one job through the full Phase 1 pipeline: resolve + validate the
 * SceneDocument, synthesize narration, check timing drift, render, upload.
 * Shared by scripts/render-local.ts (one job) and scripts/render-batch.ts
 * (several jobs reusing the same Remotion bundle for speed).
 */
export async function renderSceneDocumentJob(args: {
  request: SceneDocumentRequest;
  apiKey: string;
  bundleLocation: string;
  publicDir: string;
  outputLocation: string;
  uploadKey: string;
  audioFileName?: string;
}): Promise<RenderJobResult> {
  const sceneDocument = resolveSceneDocument(args.request);

  const tts = new ElevenLabsTTSProvider(args.apiKey);
  const ttsResult = await tts.synthesize(sceneDocument.narrationScript, { voice: sceneDocument.voice });

  const timingResult = checkSceneTiming(sceneDocument, ttsResult.durationSeconds);

  const audioFileName = args.audioFileName ?? `tts-audio-${Date.now()}.mp3`;
  await fs.writeFile(path.join(args.publicDir, audioFileName), ttsResult.audioBuffer);

  const totalDurationSeconds = Math.max(timingResult.sceneEndSeconds, ttsResult.durationSeconds) + 1;
  const inputProps: SceneInputProps = { sceneDocument, audioFileName, totalDurationSeconds };

  const renderStart = Date.now();
  const composition = await selectComposition({
    serveUrl: args.bundleLocation,
    id: "SceneRenderer",
    inputProps,
  });
  await renderMedia({
    composition,
    serveUrl: args.bundleLocation,
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
  });

  return {
    outputLocation: args.outputLocation,
    jobCost,
    timingWarnings: timingResult.warnings,
    uploadUrl,
    uploadError,
  };
}
