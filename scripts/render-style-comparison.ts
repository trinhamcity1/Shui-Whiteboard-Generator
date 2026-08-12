import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { printJobCost } from "../src/cost/index";
import { printTimingWarnings } from "../src/render/timing";
import { renderSceneDocumentJob } from "../src/pipeline/renderJob";
import { AVAILABLE_STYLE_VARIANTS } from "../src/render/theme/themes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VOICE_ID = process.env.TTS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

// Same narration + same scene structure, rendered once per style variant —
// Phase 3's verify checklist wants this to look "visibly, meaningfully
// different," not just a palette swap.
const NARRATION_SCRIPT =
  "The American flag has 13 stripes for the original 13 colonies, and 50 stars, one for each state today.";
const ACTIONS = [
  { id: "title", type: "titleCard" as const, atSeconds: 0, durationSeconds: 3, text: "The American Flag" },
  {
    id: "facts",
    type: "iconCallout" as const,
    atSeconds: 3,
    durationSeconds: 7,
    icon: "flag",
    text: "13 stripes, 50 stars",
  },
];

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set. Fill it in .env before running this script.");
  }

  const outputDir = path.join(ROOT, "output", "style-comparison");
  await fs.mkdir(outputDir, { recursive: true });

  for (const styleVariant of AVAILABLE_STYLE_VARIANTS) {
    console.log(`\n[${styleVariant}]`);
    const result = await renderSceneDocumentJob({
      request: {
        scenes: {
          schemaVersion: 1,
          narrationScript: NARRATION_SCRIPT,
          voice: VOICE_ID,
          styleVariant,
          orientation: "vertical",
          actions: ACTIONS,
        },
      },
      apiKey,
      rootDir: ROOT,
      outputLocation: path.join(outputDir, `${styleVariant}.mp4`),
      uploadKey: `local-tests/style-comparison/${styleVariant}-${Date.now()}.mp4`,
      audioFileName: `tts-audio-${styleVariant}.mp3`,
    });

    printTimingWarnings(result.timingWarnings);
    console.log(`   -> ${result.outputLocation}`);
    printJobCost(result.jobCost, styleVariant);
  }

  console.log(`\nWatch the ${AVAILABLE_STYLE_VARIANTS.length} files in output/style-comparison/ side by side.`);
}

main().catch((err) => {
  console.error("render-style-comparison failed:", err);
  process.exitCode = 1;
});
