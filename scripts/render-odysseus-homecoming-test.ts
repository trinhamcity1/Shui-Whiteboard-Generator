import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderSceneDocumentJob } from "../src/pipeline/renderJob";
import { printJobCost } from "../src/cost/index";
import { printTimingWarnings } from "../src/render/timing";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VOICE_ID = process.env.TTS_VOICE_ID!;

const ODYSSEUS_HOMECOMING_SCRIPT = `Odysseus had been gone from home for twenty years: ten fighting the Trojan War, ten more wandering the seas after Circe's warnings sent him through storms, monsters, and the underworld itself. That is why he had to go home. His wife Penelope was still waiting, his son Telemachus had grown up without a father, and his kingdom of Ithaca was falling apart in his absence. While he was gone, over a hundred suitors had taken over his palace, eating his food, drinking his wine, and pressuring Penelope to give up hope and marry one of them instead. Some of the suitors were even plotting to murder Telemachus so no rightful heir could ever challenge them. That is why Odysseus had to kill them: under the sacred law of hospitality, they had abused his household for years, and if he let them live, they would have killed his son and stolen his throne the moment his back was turned. Disguised as a beggar so no one recognized him, Odysseus returned to his own palace. He was the only man alive who could string his massive war bow, and when he did, the suitors finally realized who stood before them. He barred the doors, and with his son and two loyal servants at his side, he cut the suitors down one by one. But killing them created a new danger: their furious families wanted revenge, and Ithaca stood on the edge of a civil war. That is where Zeus's law came in. The god Zeus sent Athena down to stop the bloodshed by his own authority, forcing both sides to accept peace. His homecoming was won, but it took a god's law to keep it.`;

async function main() {
  const outputDir = path.join(ROOT, "output");
  const result = await renderSceneDocumentJob({
    request: {
      narrationScript: ODYSSEUS_HOMECOMING_SCRIPT,
      voice: VOICE_ID,
      styleVariant: "classic-whiteboard",
      orientation: "vertical",
    },
    apiKey: process.env.ELEVENLABS_API_KEY!,
    rootDir: ROOT,
    outputLocation: path.join(outputDir, "odysseus-homecoming-test.mp4"),
    uploadKey: `local-tests/odysseus-homecoming-test-${Date.now()}.mp4`,
    audioFileName: "tts-odysseus-homecoming.mp3",
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
  printJobCost(result.jobCost, "odysseus-homecoming");

  console.log("\nScene document (for inspection):");
  console.log(JSON.stringify(result.sceneDocumentDebug, null, 2));
}

main().catch((err) => {
  console.error("FULL ERROR:", err);
  console.error("STACK:", err?.stack);
  process.exit(1);
});
