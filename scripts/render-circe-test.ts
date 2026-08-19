import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderSceneDocumentJob } from "../src/pipeline/renderJob";
import { printJobCost } from "../src/cost/index";
import { printTimingWarnings } from "../src/render/timing";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VOICE_ID = process.env.TTS_VOICE_ID!;

const CIRCE_SCRIPT = `After leaving the land of the Cyclops, Odysseus and his crew were exhausted, low on supplies, and desperate for safe harbor. That's why they landed on Aeaea, the island of the sorceress Circe. Odysseus sent half his men ashore to scout. They found Circe's palace, and she welcomed them with a feast and wine. But the wine was drugged, and when they had eaten, she struck them with her wand and turned every one of them into pigs, trapping them in pens outside her hall. Only one man escaped to warn Odysseus. Odysseus went to rescue his crew himself. On the way, the god Hermes met him and gave him a magical herb called moly, which protected him from Circe's magic. When Circe tried to transform him too, the spell failed. Seeing this, she realized he was no ordinary man, and Odysseus forced her to swear an oath to do his men no harm. That is how they got out: Circe turned the pigs back into men, restored them to full health, and let them go. But Odysseus and his crew ended up staying on the island for a full year, feasting as her guests. What they gained was more than just their freedom. Before they left, Circe told Odysseus exactly what dangers lay ahead on his voyage home: he would need to visit the underworld to consult the prophet Tiresias, and she warned him about the Sirens' deadly song and the monsters Scylla and Charybdis. Without her warning, Odysseus and his men would never have survived the journey that came next.`;

async function main() {
  const outputDir = path.join(ROOT, "output");
  const result = await renderSceneDocumentJob({
    request: {
      narrationScript: CIRCE_SCRIPT,
      voice: VOICE_ID,
      styleVariant: "classic-whiteboard",
      orientation: "vertical",
    },
    apiKey: process.env.ELEVENLABS_API_KEY!,
    rootDir: ROOT,
    outputLocation: path.join(outputDir, "circe-island-test.mp4"),
    uploadKey: `local-tests/circe-island-test-${Date.now()}.mp4`,
    audioFileName: "tts-circe.mp3",
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
  printJobCost(result.jobCost, "circe-island");

  console.log("\nScene document (for inspection):");
  console.log(JSON.stringify(result.sceneDocumentDebug, null, 2));
}

main().catch((err) => {
  console.error("FULL ERROR:", err);
  console.error("STACK:", err?.stack);
  process.exit(1);
});
