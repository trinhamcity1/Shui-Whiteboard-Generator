import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { renderSceneDocumentJob } from "../src/pipeline/renderJob";
import { printJobCost } from "../src/cost/index";
import { printTimingWarnings } from "../src/render/timing";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VOICE_ID = process.env.TTS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

// A genuinely fresh topic — not civics, not something the system prompt or
// asset library has been tuned around — to see honest, ungroomed behavior
// end to end: real planning, real registry reuse (narrator), real live
// generation through the trained model for anything not in the library,
// real render. Nothing hand-authored below the narration script itself.
const NARRATION_SCRIPT = process.argv[2] === "--water-cycle"
  ? "Water is always moving through a cycle. The sun heats the ocean, and water evaporates into the air as " +
    "vapor. High in the sky, that vapor cools and condenses into clouds. When the clouds get heavy enough, " +
    "the water falls back down as rain. That rain collects in rivers and lakes, and eventually flows back " +
    "to the ocean, where the whole cycle starts again."
  : "Meditation can help improve focus and productivity. When you meditate, you train your brain to notice " +
    "when your attention wanders and gently bring it back. Over time, this makes it easier to concentrate " +
    "on a single task without getting distracted. Even five minutes a day can make a real difference.";

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set.");

  console.log("Planning + rendering a fresh, non-hardcoded topic end to end...\n");
  const outputDir = path.join(ROOT, "output");
  await fs.mkdir(outputDir, { recursive: true });

  const result = await renderSceneDocumentJob({
    request: {
      narrationScript: NARRATION_SCRIPT,
      voice: VOICE_ID,
      styleVariant: "classic-whiteboard",
      orientation: "vertical",
    },
    apiKey,
    rootDir: ROOT,
    outputLocation: path.join(outputDir, process.argv[2] === "--water-cycle" ? "water-cycle-test.mp4" : "fresh-topic-test.mp4"),
    uploadKey: `local-tests/fresh-topic-test-${Date.now()}.mp4`,
    audioFileName: "tts-audio.mp3",
    inlineImagesForLocalDev: true,
  });

  printTimingWarnings(result.timingWarnings);
  console.log(`   video -> ${result.outputLocation}`);
  if (result.uploadUrl) console.log(`   uploaded: ${result.uploadUrl}`);
  else console.warn(`   R2 upload skipped/failed: ${result.uploadError}`);

  console.log("\nCost breakdown");
  printJobCost(result.jobCost);
}

main().catch((err) => {
  console.error("render-fresh-topic-test failed:", err);
  process.exitCode = 1;
});
