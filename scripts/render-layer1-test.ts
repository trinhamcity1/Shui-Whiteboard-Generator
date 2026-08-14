import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { printJobCost } from "../src/cost/index";
import { printTimingWarnings } from "../src/render/timing";
import { renderSceneDocumentJob } from "../src/pipeline/renderJob";
import { resolveImages } from "../src/images/resolveImages";
import { parseSceneDocument } from "../src/schema/scene";
import { resolveAssetId } from "../src/images/assetLibrary/registryLookup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VOICE_ID = process.env.TTS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

// This sandbox's outbound proxy re-terminates TLS, and headless Chromium's
// bundled cert store doesn't pick up the proxy's CA the way Node's fetch
// does (confirmed working everywhere else this session) — so Chromium
// can't fetch R2-hosted images directly during compositing here, even
// though the registry lookup itself resolves the correct URL. A real
// Cloud Run deployment doesn't sit behind this proxy and won't hit this.
// Workaround for local/dev rendering only: download the resolved asset
// once via Node fetch (which does trust the CA) and serve it from public/
// instead of asking Chromium to fetch R2 directly.
async function downloadAssetLocally(assetId: string): Promise<string> {
  const resolved = await resolveAssetId(assetId);
  if (!resolved) throw new Error(`assetId "${assetId}" not found in registry.`);
  const localDir = path.join(ROOT, "public", "resolved-assets");
  fsSync.mkdirSync(localDir, { recursive: true });
  const localPath = path.join(localDir, `${assetId}.png`);
  const response = await fetch(resolved.imageUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  // Re-encode through sharp rather than writing the fetched bytes verbatim —
  // headless Chromium's PNG decoder rejected the raw file from a prior run
  // with "the source image cannot be decoded" even though it's a valid PNG
  // by every other tool; a clean re-encode removes whatever it didn't like
  // (likely something in the removeFlatBackground pipeline's raw->png path).
  const sharp = (await import("sharp")).default;
  await sharp(buffer).png().toFile(localPath);
  return `resolved-assets/${assetId}.png`;
}

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
    { id: "title", type: "titleCard", atSeconds: 0, durationSeconds: 3, text: "Hierarchy of Law" },
    {
      id: "diagram",
      type: "sketchDiagram",
      atSeconds: 3,
      durationSeconds: 11.5,
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
      atSeconds: 14.5,
      durationSeconds: 4.7,
      items: ["Federal law: the whole country", "State law: one state", "Local law: a city or county"],
    },
  ],
};

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set.");

  console.log("Pre-downloading library assets for local rendering (sandbox workaround, see comment above)...");
  const judgeLocalPath = await downloadAssetLocally("civics-judge-explaining");
  const officerLocalPath = await downloadAssetLocally("civics-officer-explaining");
  const diagramAction = SCENE_DOCUMENT.actions.find((a) => a.type === "sketchDiagram") as
    | (typeof SCENE_DOCUMENT.actions)[number] & { sketchDiagram: { leftCharacterUrl?: string; rightCharacterUrl?: string } }
    | undefined;
  if (diagramAction) {
    diagramAction.sketchDiagram.leftCharacterUrl = `/${judgeLocalPath}`;
    diagramAction.sketchDiagram.rightCharacterUrl = `/${officerLocalPath}`;
  }

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
  // Resolve assetId/sketchDiagram references ourselves first — renderStill
  // renders the composition as given, it doesn't run the pipeline's image
  // resolution step, so a raw unresolved document would render with no
  // characters (exactly the bug this fixed).
  const resolvedDocument = parseSceneDocument(SCENE_DOCUMENT);
  await resolveImages(resolvedDocument, { orientation: resolvedDocument.orientation });

  console.log("\nRendering comparison still (diagram scene)...");
  const bundleLocation = await bundle({ entryPoint: path.join(ROOT, "src/render/index.ts") });
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "SceneRenderer",
    inputProps: {
      sceneDocument: resolvedDocument,
      audioFileName: "tts-audio.mp3",
      totalDurationSeconds: 19.5,
    },
  });
  await renderStill({
    composition,
    serveUrl: bundleLocation,
    output: path.join(outputDir, "layer1-test-diagram-frame.png"),
    frame: Math.round(8.75 * 30), // mid-diagram-scene (3s-14.5s window), at 30fps
    inputProps: {
      sceneDocument: resolvedDocument,
      audioFileName: "tts-audio.mp3",
      totalDurationSeconds: 19.5,
    },
  });
  console.log(`   still -> ${path.join(outputDir, "layer1-test-diagram-frame.png")}`);
}

main().catch((err) => {
  console.error("render-layer1-test failed:", err);
  process.exitCode = 1;
});
