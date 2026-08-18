import path from "node:path";
import fs from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { ElevenLabsTTSProvider } from "../tts/elevenlabs";
import { buildJobCost, type JobCost } from "../cost/index";
import { uploadRenderToR2 } from "../storage/r2";
import { resolveAdDocument } from "./resolveAdDocument";
import type { AdInputProps } from "../render/Root";

export interface RenderAdJobResult {
  outputLocation: string;
  jobCost: JobCost;
  uploadUrl?: string;
  uploadError?: string;
  adDocumentDebug?: unknown;
}

/**
 * The ad-mode sibling of renderSceneDocumentJob — same overall shape
 * (resolve -> TTS -> bundle -> render -> upload -> cost), but no image
 * generation step at all: beats reference the business's own uploaded
 * product photos directly, resolved to Ken Burns motion at render time
 * with zero image-provider API cost.
 */
export async function renderAdJob(args: {
  request: unknown;
  apiKey: string;
  rootDir: string;
  outputLocation: string;
  uploadKey: string;
  audioFileName?: string;
}): Promise<RenderAdJobResult> {
  const { adDocument, adPlanning } = await resolveAdDocument(args.request);

  // Beats with spoken narration, concatenated in plan order, form the full
  // TTS script — a beat with no "text" (a pure-visual or pure-CTA beat)
  // contributes nothing to it.
  const narrationScript = adDocument.beats
    .map((b) => b.text)
    .filter((t): t is string => !!t && t.trim().length > 0)
    .join(" ");

  const tts = new ElevenLabsTTSProvider(args.apiKey);
  const ttsResult = narrationScript
    ? await tts.synthesize(narrationScript, { voice: adDocument.voice })
    : { audioBuffer: Buffer.alloc(0), characters: 0, costUsd: 0, durationSeconds: 0, wordTimings: [] };

  const publicDir = path.join(args.rootDir, "public");
  await fs.mkdir(publicDir, { recursive: true });
  const audioFileName = args.audioFileName ?? `tts-ad-${Date.now()}.mp3`;
  await fs.writeFile(path.join(publicDir, audioFileName), ttsResult.audioBuffer);

  const bundleLocation = await bundle({
    entryPoint: path.join(args.rootDir, "src/render/index.ts"),
    publicDir,
  });

  const inputProps: AdInputProps = { adDocument, audioFileName };

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "AdRenderer",
    inputProps,
  });

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

  const jobCost = buildJobCost({
    ttsCharacters: ttsResult.characters,
    ttsCostUsd: ttsResult.costUsd,
    renderWallClockSeconds,
    scenePlanningLLMTokens: adPlanning.tokensUsed,
    scenePlanningCostUsd: adPlanning.costUsd,
    // No image-generation step in ad mode — beats reference the business's
    // own uploaded photos, resolved to Ken Burns motion at render time
    // with zero image-provider cost.
    imagesGenerated: 0,
    imageCacheHits: 0,
    imageGenerationCostUsd: 0,
  });

  return {
    outputLocation: args.outputLocation,
    jobCost,
    uploadUrl,
    uploadError,
    adDocumentDebug: adDocument,
  };
}
