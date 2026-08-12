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

// A quality ceiling test, not the default pipeline experience: uses the
// "vivid-lesson" prompt style (src/images/promptStyle.ts) instead of the
// classic-whiteboard "simple line illustration" prompt, and a real,
// naturally colorful science-lesson topic with two illustrations instead
// of one, to see what these providers can actually do when asked for real
// visual richness. Video typography falls back to classic-whiteboard
// (vivid-lesson isn't a shipped StyleTheme) — only the image prompts use it.
const NARRATION_SCRIPT =
  "Water is always moving in a cycle. The sun heats the ocean, and water rises into the air as invisible " +
  "vapor. High in the sky, that vapor cools and gathers into clouds. When the clouds get heavy enough, " +
  "the water falls back down as rain, filling rivers and lakes, and the whole cycle begins again.";

const ACTIONS = [
  { id: "title", type: "titleCard" as const, atSeconds: 0, durationSeconds: 3, text: "The Water Cycle" },
  {
    id: "evaporation",
    type: "fullBleedGraphic" as const,
    atSeconds: 3,
    durationSeconds: 6,
    // The "vivid-lesson" prompt style already supplies the color/mood/quality
    // language (see promptStyle.ts) — this stays scene-specific and under
    // the schema's 300-char imageConcept limit.
    imageConcept:
      "a bright sunny ocean, golden sunlight on sparkling blue water, soft wispy vapor rising off the " +
      "surface into a gradient sky fading from warm orange to cool blue, a few fluffy white clouds forming",
  },
  {
    id: "facts",
    type: "bulletList" as const,
    atSeconds: 9,
    durationSeconds: 6,
    items: ["Sun heats the ocean", "Water rises as vapor", "Vapor cools into clouds"],
  },
  {
    id: "rainfall",
    type: "fullBleedGraphic" as const,
    atSeconds: 15,
    durationSeconds: 6,
    imageConcept:
      "a lush green valley with rolling hills under a fluffy grey-white rain cloud, gentle blue rain " +
      "falling in soft diagonal streaks onto the hills and a winding river below, a faint rainbow arching " +
      "across the sky",
  },
];

async function runProvider(provider: ImageProviderName) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set. Fill it in .env before running this script.");
  }

  const outputDir = path.join(ROOT, "output", "illustration-quality-test");
  await fs.mkdir(outputDir, { recursive: true });

  console.log(`\n[${provider}]`);
  const result = await renderSceneDocumentJob({
    request: {
      scenes: {
        schemaVersion: 1,
        narrationScript: NARRATION_SCRIPT,
        voice: VOICE_ID,
        styleVariant: "vivid-lesson",
        orientation: "vertical",
        actions: ACTIONS,
      },
      imageProvider: provider,
    },
    apiKey,
    rootDir: ROOT,
    outputLocation: path.join(outputDir, `${provider}.mp4`),
    uploadKey: `local-tests/illustration-quality-test/${provider}-${Date.now()}.mp4`,
    audioFileName: `tts-audio-quality-${provider}.mp3`,
  });

  printTimingWarnings(result.timingWarnings);
  console.log(`   -> ${result.outputLocation}`);
  printJobCost(result.jobCost, provider);

  return result.jobCost;
}

async function main() {
  const provider = (process.argv[2] as ImageProviderName | undefined) ?? "recraft";
  if (provider !== "recraft" && provider !== "flux") {
    throw new Error('Usage: npm run render-illustration-quality-test -- recraft|flux (defaults to "recraft")');
  }
  if (provider === "recraft" && !process.env.RECRAFT_API_KEY) throw new Error("RECRAFT_API_KEY is not set. Fill it in .env.");
  if (provider === "flux" && !process.env.FLUX_API_KEY) throw new Error("FLUX_API_KEY is not set. Fill it in .env.");

  const cost = await runProvider(provider);
  console.log(`\n${provider}: 2 illustrations, $${(cost.imageGenerationCostUsd ?? 0).toFixed(4)} for images, $${cost.totalCostUsd.toFixed(4)} total.`);
}

main().catch((err) => {
  console.error("render-illustration-quality-test failed:", err);
  process.exitCode = 1;
});
