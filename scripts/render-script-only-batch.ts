import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { printJobCost, type JobCost } from "../src/cost/index";
import { printTimingWarnings } from "../src/render/timing";
import { renderSceneDocumentJob } from "../src/pipeline/renderJob";
import type { SceneDocumentRequest } from "../src/pipeline/resolveSceneDocument";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VOICE_ID = process.env.TTS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

// Five varied, real scripts with NO hand-authored actions — the whole
// point is proving the LLM planner produces a coherent visual plan on
// content it's never seen, not just the one script used while building it.
const SCRIPTS = [
  "Photosynthesis is how plants make their own food. They use sunlight, water, and carbon dioxide to " +
    "produce sugar and oxygen. Chlorophyll in the leaves captures the sunlight needed for this process.",
  "The water cycle moves water around our planet in a continuous loop. Water evaporates from oceans and " +
    "lakes, forms clouds through condensation, falls back as precipitation, and collects again to start over.",
  "A budget helps you plan how to spend and save your money. First, list your income. Then list your " +
    "expenses. Finally, make sure your spending doesn't exceed what you earn, and set aside savings each month.",
  "The Great Wall of China was built over many centuries to protect Chinese states from invasions. It " +
    "stretches thousands of miles and remains one of the most impressive construction projects in history.",
  "Newton's three laws of motion describe how objects move. An object at rest stays at rest unless acted " +
    "on by a force. Force equals mass times acceleration. Every action has an equal and opposite reaction.",
];

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set. Fill it in .env before running this script.");
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Required for the narrationScript-only path — fill it in .env.");
  }

  const outputDir = path.join(ROOT, "output", "script-only-batch");
  await fs.mkdir(outputDir, { recursive: true });

  const results: Array<{ name: string; cost: JobCost }> = [];

  for (const [i, narrationScript] of SCRIPTS.entries()) {
    const name = `script-only-${i + 1}`;
    console.log(`\n[${i + 1}/${SCRIPTS.length}] ${name}`);

    const request: SceneDocumentRequest = {
      narrationScript,
      voice: VOICE_ID,
      styleVariant: "classic-whiteboard",
      orientation: "vertical",
    };

    const result = await renderSceneDocumentJob({
      request,
      apiKey,
      rootDir: ROOT,
      outputLocation: path.join(outputDir, `${name}.mp4`),
      uploadKey: `local-tests/script-only-batch/${name}-${Date.now()}.mp4`,
      audioFileName: `tts-audio-${name}.mp3`,
    });

    printTimingWarnings(result.timingWarnings);
    console.log(`   -> ${result.outputLocation}`);
    printJobCost(result.jobCost, name);

    results.push({ name, cost: result.jobCost });
  }

  console.log("\n=== Script-only batch summary ===");
  for (const r of results) {
    console.log(
      `  ${r.name.padEnd(20)} total $${r.cost.totalCostUsd.toFixed(4)}  (planning $${(r.cost.scenePlanningCostUsd ?? 0).toFixed(4)})`,
    );
  }
}

main().catch((err) => {
  console.error("render-script-only-batch failed:", err);
  process.exitCode = 1;
});
