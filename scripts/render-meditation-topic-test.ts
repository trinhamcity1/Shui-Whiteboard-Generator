import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderSceneDocumentJob } from "../src/pipeline/renderJob";
import { printJobCost } from "../src/cost/index";
import { printTimingWarnings } from "../src/render/timing";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VOICE_ID = process.env.TTS_VOICE_ID!;

async function main() {
  const outputDir = path.join(ROOT, "output");
  const result = await renderSceneDocumentJob({
    request: {
      topic: "how to meditate",
      targetDurationSeconds: 90,
      voice: VOICE_ID,
      styleVariant: "classic-whiteboard",
      orientation: "vertical",
    },
    apiKey: process.env.ELEVENLABS_API_KEY!,
    rootDir: ROOT,
    outputLocation: path.join(outputDir, "meditation-topic-test.mp4"),
    uploadKey: `local-tests/meditation-topic-test-${Date.now()}.mp4`,
    audioFileName: "tts-meditation.mp3",
    inlineImagesForLocalDev: true,
  });

  console.log("   video ->", result.outputLocation);
  if (result.uploadUrl) console.log("   uploaded:", result.uploadUrl);
  if (result.uploadError) console.log("   upload error:", result.uploadError);
  printTimingWarnings(result.timingWarnings);
  printJobCost(result.jobCost, "meditation-topic-test");

  console.log("\nScene document narration (for inspection):");
  console.log((result.sceneDocumentDebug as { narrationScript: string }).narrationScript);
}

main().catch((err) => {
  console.error("FULL ERROR:", err);
  console.error("STACK:", err?.stack);
  process.exit(1);
});
