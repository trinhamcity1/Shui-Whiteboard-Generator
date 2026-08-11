import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { printJobCost } from "../src/cost/index";
import { printTimingWarnings } from "../src/render/timing";
import { bundleRenderer, renderSceneDocumentJob } from "../src/pipeline/renderJob";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const VOICE_ID = process.env.TTS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

// A real Shui citizenship-exam quick fact, pre-authored as a full
// SceneDocument (the path Shui's own Phase 7 will use once a human has
// reviewed a script's visual plan) — exercises the whole Phase 1 pipeline:
// schema validation, multiple action types, timing checks, R2 upload.
const SCENE_DOCUMENT = {
  schemaVersion: 1,
  narrationScript:
    "The Constitution can be changed. When we change the Constitution, we call it an amendment. " +
    "The Founding Fathers wrote the first ten amendments together. We call these first ten amendments " +
    "the Bill of Rights. The Bill of Rights protects your basic freedoms as an American, like freedom " +
    "of speech, freedom of religion, and the right to a fair trial.",
  voice: VOICE_ID,
  styleVariant: "classic-whiteboard",
  orientation: "vertical",
  actions: [
    { id: "title", type: "titleCard", atSeconds: 0, durationSeconds: 4, text: "The Bill of Rights" },
    {
      id: "facts",
      type: "bulletList",
      atSeconds: 4,
      durationSeconds: 10,
      items: [
        "The first 10 amendments to the Constitution",
        "Protects freedom of speech and religion",
        "Guarantees the right to a fair trial",
      ],
    },
    {
      id: "callout",
      type: "iconCallout",
      atSeconds: 14,
      durationSeconds: 6,
      icon: "scale-of-justice",
      text: "Written by the Founding Fathers",
    },
    {
      id: "timeline",
      type: "timeline",
      atSeconds: 20,
      durationSeconds: 6,
      timelineEntries: [{ year: 1791, label: "Bill of Rights ratified" }],
    },
  ],
};

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set. Fill it in .env before running this script.");
  }

  console.log("1/3 — Bundling Remotion project...");
  const { bundleLocation, publicDir } = await bundleRenderer(ROOT);

  console.log("2/3 — Resolving SceneDocument, synthesizing narration, and rendering...");
  const outputDir = path.join(ROOT, "output");
  await fs.mkdir(outputDir, { recursive: true });

  const result = await renderSceneDocumentJob({
    request: { scenes: SCENE_DOCUMENT },
    apiKey,
    bundleLocation,
    publicDir,
    outputLocation: path.join(outputDir, "test-1.mp4"),
    uploadKey: `local-tests/test-1-${Date.now()}.mp4`,
    audioFileName: "tts-audio.mp3",
  });

  printTimingWarnings(result.timingWarnings);
  console.log(`   done -> ${result.outputLocation}`);
  if (result.uploadUrl) {
    console.log(`   uploaded: ${result.uploadUrl}`);
  } else {
    console.warn(`   ⚠️  R2 upload skipped/failed: ${result.uploadError}`);
  }

  console.log("3/3 — Cost breakdown");
  printJobCost(result.jobCost);
}

main().catch((err) => {
  console.error("render-local failed:", err);
  process.exitCode = 1;
});
