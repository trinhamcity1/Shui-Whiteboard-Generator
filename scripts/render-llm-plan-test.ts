import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { renderSceneDocumentJob } from "../src/pipeline/renderJob";
import { printJobCost } from "../src/cost/index";
import { printTimingWarnings } from "../src/render/timing";
import { resolveAssetId } from "../src/images/assetLibrary/registryLookup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VOICE_ID = process.env.TTS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

// The exact JSON planScenesFromScript produced, unedited — rendering it as-is
// to actually see what the LLM's scene plan looks like, not just read the JSON.
const NARRATION_SCRIPT =
  "In the United States, laws come from three levels of government. " +
  "At the top is the Constitution. Below it, federal law applies to the whole country. " +
  "State law applies within one state. And local law applies within a city or county. " +
  "A judge and an officer both help enforce these laws every day.";

const LLM_ACTIONS = [
  { id: "title", type: "titleCard", atSeconds: 0, durationSeconds: 2, text: "The Three Levels of U.S. Law" },
  {
    id: "constitution-intro",
    type: "iconCallout",
    atSeconds: 2,
    durationSeconds: 3,
    text: "The Constitution is the foundation of all U.S. law",
    icon: "document-text",
  },
  {
    id: "three-levels",
    type: "bulletList",
    atSeconds: 5,
    durationSeconds: 6,
    items: [
      "Federal law applies to the whole country",
      "State law applies within one state",
      "Local law applies within a city or county",
    ],
  },
  {
    id: "law-hierarchy",
    type: "sketchDiagram",
    atSeconds: 11,
    durationSeconds: 5,
    sketchDiagram: {
      title: "Hierarchy of U.S. Law",
      topLabel: "Higher Authority",
      tiers: [{ label: "Constitution" }, { label: "Federal Law" }, { label: "State Law" }, { label: "Local Law" }],
      bottomBanner: "Lower Authority",
    },
  },
  {
    id: "enforcement",
    type: "bulletList",
    atSeconds: 16,
    durationSeconds: 3,
    items: ["Judges enforce laws in court", "Officers enforce laws in communities"],
  },
  {
    id: "closing-visual",
    type: "documentReveal",
    atSeconds: 19,
    durationSeconds: 2.2,
    assetId: "civics-prop-constitution-scroll",
  },
];

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set.");

  // Same sandbox workaround as the Layer 1 test: resolve the one assetId
  // reference to a base64 data URI ourselves, bypassing the unresolved
  // static-file-serving gap in this environment.
  const scrollAction = LLM_ACTIONS.find((a) => a.id === "closing-visual") as
    | (typeof LLM_ACTIONS)[number] & { imageUrl?: string }
    | undefined;
  if (scrollAction) {
    const resolved = await resolveAssetId("civics-prop-constitution-scroll");
    if (!resolved) throw new Error("civics-prop-constitution-scroll not found in registry.");
    const response = await fetch(resolved.imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    scrollAction.imageUrl = `data:image/png;base64,${buffer.toString("base64")}`;
  }

  const sceneDocument = {
    schemaVersion: 1,
    narrationScript: NARRATION_SCRIPT,
    voice: VOICE_ID,
    styleVariant: "classic-whiteboard",
    orientation: "vertical",
    actions: LLM_ACTIONS,
  };

  console.log("Rendering the LLM's exact scene plan...");
  const outputDir = path.join(ROOT, "output");
  await fs.mkdir(outputDir, { recursive: true });

  const result = await renderSceneDocumentJob({
    request: { scenes: sceneDocument },
    apiKey,
    rootDir: ROOT,
    outputLocation: path.join(outputDir, "llm-plan-test.mp4"),
    uploadKey: `local-tests/llm-plan-test-${Date.now()}.mp4`,
    audioFileName: "tts-audio.mp3",
  });

  printTimingWarnings(result.timingWarnings);
  console.log(`   video -> ${result.outputLocation}`);
  if (result.uploadUrl) console.log(`   uploaded: ${result.uploadUrl}`);
  else console.warn(`   R2 upload skipped/failed: ${result.uploadError}`);

  console.log("\nCost breakdown");
  printJobCost(result.jobCost);
}

main().catch((err) => {
  console.error("render-llm-plan-test failed:", err);
  process.exitCode = 1;
});
