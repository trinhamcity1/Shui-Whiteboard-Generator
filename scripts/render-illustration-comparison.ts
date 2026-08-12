import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { printJobCost, type JobCost } from "../src/cost/index";
import { printTimingWarnings } from "../src/render/timing";
import { renderSceneDocumentJob } from "../src/pipeline/renderJob";
import type { ImageProviderName } from "../src/images/index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VOICE_ID = process.env.TTS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

// Same scene structure, same style, same narration — only imageProvider
// changes between runs. This is the artifact that should actually decide
// which provider ships as default, per the Phase 4 spec, not a guess.
const NARRATION_SCRIPT =
  "Voting by ballot box has a long history. A voter marks their choice on paper, then folds it and " +
  "places it inside a locked wooden ballot box for counting later. This simple system protects the " +
  "secrecy of each person's vote.";

const ACTIONS = [
  { id: "title", type: "titleCard" as const, atSeconds: 0, durationSeconds: 3, text: "The Ballot Box" },
  {
    id: "illustration",
    type: "fullBleedGraphic" as const,
    atSeconds: 3,
    durationSeconds: 6,
    imageConcept: "a simple line drawing of a wooden ballot box with a folded paper being inserted into the slot",
  },
  {
    id: "facts",
    type: "bulletList" as const,
    atSeconds: 9,
    durationSeconds: 6,
    items: ["Voter marks their choice on paper", "Paper is folded for privacy", "Box is locked until counting"],
  },
];

async function runProvider(provider: ImageProviderName) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set. Fill it in .env before running this script.");
  }

  const outputDir = path.join(ROOT, "output", "illustration-comparison");
  await fs.mkdir(outputDir, { recursive: true });

  console.log(`\n[${provider}]`);
  const result = await renderSceneDocumentJob({
    request: {
      scenes: {
        schemaVersion: 1,
        narrationScript: NARRATION_SCRIPT,
        voice: VOICE_ID,
        styleVariant: "classic-whiteboard",
        orientation: "vertical",
        actions: ACTIONS,
      },
      imageProvider: provider,
    },
    apiKey,
    rootDir: ROOT,
    outputLocation: path.join(outputDir, `${provider}.mp4`),
    uploadKey: `local-tests/illustration-comparison/${provider}-${Date.now()}.mp4`,
    audioFileName: `tts-audio-illustration-${provider}.mp3`,
  });

  printTimingWarnings(result.timingWarnings);
  console.log(`   -> ${result.outputLocation}`);
  printJobCost(result.jobCost, provider);

  return result.jobCost;
}

async function main() {
  if (!process.env.RECRAFT_API_KEY) throw new Error("RECRAFT_API_KEY is not set. Fill it in .env.");
  if (!process.env.FLUX_API_KEY) throw new Error("FLUX_API_KEY is not set. Fill it in .env.");

  const results: Record<ImageProviderName, JobCost> = {
    recraft: await runProvider("recraft"),
    flux: await runProvider("flux"),
  };

  console.log("\n=== Illustration provider comparison ===");
  console.log(`${"Provider".padEnd(10)}${"Images".padEnd(10)}${"Image $".padEnd(12)}${"Render (s)".padEnd(12)}Total $`);
  for (const [provider, cost] of Object.entries(results)) {
    console.log(
      `${provider.padEnd(10)}${String(cost.imagesGenerated ?? 0).padEnd(10)}$${(cost.imageGenerationCostUsd ?? 0)
        .toFixed(4)
        .padEnd(11)}${cost.renderWallClockSeconds.toFixed(1).padEnd(12)}$${cost.totalCostUsd.toFixed(4)}`,
    );
  }
  console.log("\nWatch output/illustration-comparison/recraft.mp4 and flux.mp4 side by side to decide the default.");
}

main().catch((err) => {
  console.error("render-illustration-comparison failed:", err);
  process.exitCode = 1;
});
