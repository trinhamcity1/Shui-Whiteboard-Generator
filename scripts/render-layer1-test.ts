import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { printJobCost } from "../src/cost/index";
import { printTimingWarnings } from "../src/render/timing";
import { renderSceneDocumentJob } from "../src/pipeline/renderJob";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VOICE_ID = process.env.TTS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

// Layer 1's actual finish line: one real video, hand-authored (not
// LLM-planned, so assetId/sketchDiagram are exercised deterministically),
// using real library assets and the real sketchDiagram pipeline path -
// not standalone prototypes. Mirrors the Golpo "Hierarchy of Law" /
// "Judicial Review" reference frames this whole effort has been chasing.
const SCENE_DOCUMENT = {
  schemaVersion: 1,
  narrationScript:
    "In the United States, laws come from three levels of government. " +
    "At the top is the Constitution. Below it, federal law applies to the whole country. " +
    "State law applies within one state. And local law applies within a city or county. " +
    "A judge and an officer both help enforce these laws every day.",
  voice: VOICE_ID,
  styleVariant: "classic-whiteboard",
  orientation: "vertical",
  actions: [
    { id: "title", type: "titleCard", atSeconds: 0, durationSeconds: 4, text: "Hierarchy of Law" },
    {
      id: "diagram",
      type: "sketchDiagram",
      atSeconds: 4,
      durationSeconds: 16,
      sketchDiagram: {
        title: "HIERARCHY OF LAW",
        topLabel: "CONSTITUTION",
        tiers: [
          { label: "FEDERAL" },
          { label: "STATE" },
          { label: "LOCAL" },
        ],
        bottomBanner: "UNITED STATES",
        leftCharacterAssetId: "civics-judge-explaining",
        rightCharacterAssetId: "civics-officer-explaining",
      },
    },
    {
      id: "closing",
      type: "bulletList",
      atSeconds: 20,
      durationSeconds: 6,
      items: ["Federal law: the whole country", "State law: one state", "Local law: a city or county"],
    },
  ],
};

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set.");

  console.log("Rendering Layer 1 test video (real TTS, real library assets, real sketchDiagram)...");
  const outputDir = path.join(ROOT, "output");
  await fs.mkdir(outputDir, { recursive: true });

  const result = await renderSceneDocumentJob({
    request: { scenes: SCENE_DOCUMENT },
    apiKey,
    rootDir: ROOT,
    outputLocation: path.join(outputDir, "layer1-test.mp4"),
    uploadKey: `local-tests/layer1-test-${Date.now()}.mp4`,
    audioFileName: "tts-audio.mp3",
  });

  printTimingWarnings(result.timingWarnings);
  console.log(`   video -> ${result.outputLocation}`);
  if (result.uploadUrl) console.log(`   uploaded: ${result.uploadUrl}`);
  else console.warn(`   R2 upload skipped/failed: ${result.uploadError}`);

  console.log("\nCost breakdown");
  printJobCost(result.jobCost);

  // A still frame from the diagram scene, for a direct side-by-side against
  // the Golpo reference frame, without needing ffmpeg to extract from the mp4.
  console.log("\nRendering comparison still (diagram scene)...");
  const bundleLocation = await bundle({ entryPoint: path.join(ROOT, "src/render/index.ts") });
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "SceneRenderer",
    inputProps: {
      sceneDocument: SCENE_DOCUMENT,
      audioFileName: "tts-audio.mp3",
      totalDurationSeconds: 26,
    },
  });
  await renderStill({
    composition,
    serveUrl: bundleLocation,
    output: path.join(outputDir, "layer1-test-diagram-frame.png"),
    frame: 12 * 30, // ~12s in, mid-diagram-scene, at 30fps
    inputProps: {
      sceneDocument: SCENE_DOCUMENT,
      audioFileName: "tts-audio.mp3",
      totalDurationSeconds: 26,
    },
  });
  console.log(`   still -> ${path.join(outputDir, "layer1-test-diagram-frame.png")}`);
}

main().catch((err) => {
  console.error("render-layer1-test failed:", err);
  process.exitCode = 1;
});
