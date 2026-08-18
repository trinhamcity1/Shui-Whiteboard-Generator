import path from "node:path";
import fs from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { ElevenLabsTTSProvider } from "../tts/elevenlabs";
import { buildJobCost, type JobCost } from "../cost/index";
import { uploadRenderToR2 } from "../storage/r2";
import { resolveAdDocument } from "./resolveAdDocument";
import { inlineAdImagesForLocalDev } from "./localDevInlining";
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
  ownerApiKeyId: string;
  apiKey: string;
  rootDir: string;
  outputLocation: string;
  uploadKey: string;
  audioFileName?: string;
  /** See localDevInlining.ts — opt-in workaround for this sandbox only, never set in production. */
  inlineImagesForLocalDev?: boolean;
}): Promise<RenderAdJobResult> {
  const { adDocument, adPlanning, backgroundRemoval } = await resolveAdDocument(args.request, args.ownerApiKeyId, {
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  if (args.inlineImagesForLocalDev) {
    await inlineAdImagesForLocalDev(adDocument);
  }

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
    // photo-real beats reference the business's own uploaded photos
    // directly (zero image-provider cost); kinetic-hero beats run a real
    // fal.ai background-removal call per distinct product photo they
    // reference — tracked here under the same "images" line rather than
    // a bespoke field, since it's the same kind of per-image vendor cost
    // the whiteboard pipeline's imageGenerationCostUsd already represents.
    // No imageProvider set here — it's fal.ai's rembg endpoint, not one of
    // the three named illustration providers that field's type models;
    // printJobCost just shows "?" for provider, which is honest.
    imagesGenerated: backgroundRemoval.imagesProcessed,
    imageCacheHits: 0,
    imageGenerationCostUsd: backgroundRemoval.costUsd,
  });

  return {
    outputLocation: args.outputLocation,
    jobCost,
    uploadUrl,
    uploadError,
    adDocumentDebug: adDocument,
  };
}
