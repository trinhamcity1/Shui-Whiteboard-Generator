import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderSceneDocumentJob } from "../src/pipeline/renderJob";
import { printJobCost } from "../src/cost/index";
import { printTimingWarnings } from "../src/render/timing";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VOICE_ID = process.env.TTS_VOICE_ID!;

const DROWNING_RESCUE_SCRIPT = `Drowning almost never looks like it does in movies. There's usually no screaming, no waving, no splashing. A drowning person is often silent, their body upright in the water, mouth barely above the surface, arms pressing down at their sides instead of waving. If someone looks like they're struggling to keep their head up and isn't making progress, that's your warning sign. The first thing to do is call for help immediately. Yell for a lifeguard, or call emergency services, before you do anything else. Never assume someone else has already called. The safest rule for you is simple: reach or throw, don't go. If you can reach them with a pole, an oar, or even a branch, extend it and pull them to safety without entering the water yourself. If you're too far to reach, throw them something that floats: a life ring, a cooler, even a pool noodle. Untrained rescuers drown every year trying to swim out to save someone, because a panicked person will grab onto you and pull you both under. Only enter the water yourself if you have rescue training, or if there is truly no other option and you bring a flotation device with you. If you must swim out, approach from behind them, not from the front, so they can't grab onto you directly. Once you reach shore, check if the person is breathing. If they are not, begin CPR immediately and keep going until emergency responders arrive. Every one of these steps exists for one reason: protecting the rescuer is what makes a rescue actually possible.`;

async function main() {
  const outputDir = path.join(ROOT, "output");
  const result = await renderSceneDocumentJob({
    request: {
      narrationScript: DROWNING_RESCUE_SCRIPT,
      voice: VOICE_ID,
      styleVariant: "classic-whiteboard",
      orientation: "vertical",
    },
    apiKey: process.env.ELEVENLABS_API_KEY!,
    rootDir: ROOT,
    outputLocation: path.join(outputDir, "drowning-rescue-test.mp4"),
    uploadKey: `local-tests/drowning-rescue-test-${Date.now()}.mp4`,
    audioFileName: "tts-drowning-rescue.mp3",
    inlineImagesForLocalDev: true,
    enableLayoutQA: true,
  });

  console.log("   video ->", result.outputLocation);
  if (result.uploadUrl) console.log("   uploaded:", result.uploadUrl);
  if (result.uploadError) console.log("   upload error:", result.uploadError);
  printTimingWarnings(result.timingWarnings);
  if (result.layoutQaLog && result.layoutQaLog.length > 0) {
    console.log("\nLayout QA log:");
    for (const entry of result.layoutQaLog) {
      console.log(`  action "${entry.actionId}": passed=${entry.passed} adjustmentApplied=${entry.adjustmentApplied} cost=${entry.costUsd.toFixed(4)}`);
      if (entry.issues.length > 0) console.log(`    issues: ${entry.issues.join("; ")}`);
    }
  }
  if (result.assetPromotionLog && result.assetPromotionLog.length > 0) {
    console.log("\nAsset promotion log:");
    console.log(result.assetPromotionLog.join("\n"));
  }
  printJobCost(result.jobCost, "drowning-rescue");

  console.log("\nScene document (for inspection):");
  console.log(JSON.stringify(result.sceneDocumentDebug, null, 2));
}

main().catch((err) => {
  console.error("FULL ERROR:", err);
  console.error("STACK:", err?.stack);
  process.exit(1);
});
