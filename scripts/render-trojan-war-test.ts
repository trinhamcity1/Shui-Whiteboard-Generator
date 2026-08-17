import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderSceneDocumentJob } from "../src/pipeline/renderJob";
import { printJobCost } from "../src/cost/index";
import { printTimingWarnings } from "../src/render/timing";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VOICE_ID = process.env.TTS_VOICE_ID!;

const TROJAN_WAR_SCRIPT = `The Trojan War happened around the twelve hundreds BCE, in the late Bronze Age, on the coast of what is now Turkey. Legend says it began when Paris, a prince of Troy, took Helen, the wife of the Spartan king Menelaus, back to Troy with him. Menelaus called on his brother Agamemnon, king of Mycenae, and together they gathered the kings of Greece into one massive army to sail for Troy and take Helen back. But the real cause ran deeper than one stolen wife. Greek city-states were hungry for Troy's wealth, since Troy controlled the trade routes into the Black Sea and grew rich taxing every ship that passed. The war itself became a brutal ten-year siege. The Greeks camped outside Troy's massive walls, unable to break through, while Troy's allies kept the city supplied. Both sides lost their greatest heroes: Achilles, the Greeks' best warrior, was killed by an arrow to his heel, and Hector, Troy's greatest defender, fell to Achilles before that. The turning point came not on the battlefield but through trickery. The Greeks built a massive wooden horse, hid their best soldiers inside it, and pretended to sail away in defeat. The Trojans, thinking the war was won, dragged the horse inside their own walls to celebrate. That night, the hidden Greek soldiers climbed out, opened the gates, and let the entire Greek army back into the city. Troy was burned to the ground. In the end, the Greeks won, but the cost was staggering. Most of the Greek kings who survived struggled to even return home, cursed by years of war and the gods' anger. Troy itself was destroyed completely, its people killed or enslaved, its wealth and trade routes gone forever. Nobody truly benefited: Greece was left exhausted, and Troy no longer existed at all.`;

async function main() {
  const outputDir = path.join(ROOT, "output");
  const result = await renderSceneDocumentJob({
    request: {
      narrationScript: TROJAN_WAR_SCRIPT,
      voice: VOICE_ID,
      styleVariant: "classic-whiteboard",
      orientation: "vertical",
    },
    apiKey: process.env.ELEVENLABS_API_KEY!,
    rootDir: ROOT,
    outputLocation: path.join(outputDir, "trojan-war-test.mp4"),
    uploadKey: `local-tests/trojan-war-test-${Date.now()}.mp4`,
    audioFileName: "tts-trojan-war.mp3",
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
  printJobCost(result.jobCost, "trojan-war");

  console.log("\nScene document (for inspection):");
  console.log(JSON.stringify(result.sceneDocumentDebug, null, 2));
}

main().catch((err) => {
  console.error("FULL ERROR:", err);
  console.error("STACK:", err?.stack);
  process.exit(1);
});
