import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { ElevenLabsTTSProvider } from "../src/tts/elevenlabs.js";
import { buildJobCost, printJobCost } from "../src/cost/index.js";
import type { TestSceneInputProps } from "../src/render/Root.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// A real Shui citizenship-exam quick fact, used as the first real content
// this project ever renders instead of throwaway lorem ipsum.
const NARRATION_SCRIPT =
  "The Constitution can be changed. When we change the Constitution, we call it an amendment. " +
  "The Founding Fathers wrote the first ten amendments together. We call these first ten amendments " +
  "the Bill of Rights. The Bill of Rights protects your basic freedoms as an American, like freedom " +
  "of speech, freedom of religion, and the right to a fair trial.";

const TITLE_TEXT = "The Bill of Rights";
const BULLET_ITEMS = [
  "The first 10 amendments to the Constitution",
  "Protects freedom of speech and religion",
  "Guarantees the right to a fair trial",
];

const VOICE_ID = process.env.TTS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM"; // ElevenLabs "Rachel"

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set. Fill it in .env before running this script.");
  }

  console.log("1/4 — Synthesizing narration via ElevenLabs...");
  const tts = new ElevenLabsTTSProvider(apiKey);
  const ttsResult = await tts.synthesize(NARRATION_SCRIPT, { voice: VOICE_ID });
  console.log(
    `   done: ${ttsResult.durationSeconds.toFixed(1)}s of audio, ${ttsResult.characters} characters, ${
      ttsResult.wordTimings?.length ?? 0
    } word timings`,
  );

  const publicDir = path.join(ROOT, "public");
  await fs.mkdir(publicDir, { recursive: true });
  const audioFileName = "tts-audio.mp3";
  await fs.writeFile(path.join(publicDir, audioFileName), ttsResult.audioBuffer);

  console.log("2/4 — Bundling Remotion project...");
  const bundleLocation = await bundle({
    entryPoint: path.join(ROOT, "src/render/index.ts"),
    publicDir,
  });

  const titleDurationSeconds = 3;
  const totalDurationSeconds = Math.max(ttsResult.durationSeconds + 1, titleDurationSeconds + 3);

  const inputProps: TestSceneInputProps = {
    titleText: TITLE_TEXT,
    bulletItems: BULLET_ITEMS,
    titleDurationInFrames: titleDurationSeconds * 30,
    audioFileName,
    totalDurationSeconds,
  };

  console.log("3/4 — Rendering video...");
  const renderStart = Date.now();

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "TestScene",
    inputProps,
  });

  const outputDir = path.join(ROOT, "output");
  await fs.mkdir(outputDir, { recursive: true });
  const outputLocation = path.join(outputDir, "test-1.mp4");

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation,
    inputProps,
  });

  const renderWallClockSeconds = (Date.now() - renderStart) / 1000;
  console.log(`   done in ${renderWallClockSeconds.toFixed(1)}s -> ${outputLocation}`);

  console.log("4/4 — Cost breakdown");
  const jobCost = buildJobCost({
    ttsCharacters: ttsResult.characters,
    ttsCostUsd: ttsResult.costUsd,
    renderWallClockSeconds,
  });
  printJobCost(jobCost);
}

main().catch((err) => {
  console.error("render-local failed:", err);
  process.exitCode = 1;
});
