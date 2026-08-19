import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { selectComposition } from "@remotion/renderer";
import { parseSceneDocument, type DecorationSpec } from "../src/schema/scene";
import { runLayoutQA } from "../src/pipeline/layoutQA";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// A deliberately over-decorated scene (Revision-3 doc Verify #6's
// "over-decoration case", constructed test scene) — a dozen sparkles and
// motion dashes scattered over a plain title card, well past the "3-6 per
// scene" guidance. Real test: does the QA loop actually flag this and
// drop one?
const decorations: DecorationSpec[] = [];
for (let i = 0; i < 12; i++) {
  decorations.push({ kind: "sparkle", x: 100 + (i % 4) * 250, y: 300 + Math.floor(i / 4) * 300, size: 20, color: "#f49b4a" });
}

const DOC = {
  schemaVersion: 1,
  narrationScript: "test",
  voice: "x",
  styleVariant: "classic-whiteboard",
  orientation: "vertical",
  actions: [
    { id: "1", type: "sketchDiagram", atSeconds: 0, durationSeconds: 5, sketchDiagram: {
      diagramType: "pyramid",
      title: "TEST",
      tiers: [{ label: "A" }, { label: "B" }, { label: "C" }],
    }, decorations },
  ],
};

async function main() {
  const sceneDocument = parseSceneDocument(DOC);
  const bundleLocation = await bundle({ entryPoint: path.join(ROOT, "src/render/index.ts") });
  const inputProps = { sceneDocument, audioFileName: "none.mp3", totalDurationSeconds: 6 };
  const composition = await selectComposition({ serveUrl: bundleLocation, id: "SceneRenderer", inputProps });

  console.log(`Before: action has ${sceneDocument.actions[0]!.decorations!.length} decorations`);

  const log = await runLayoutQA({
    sceneDocument,
    bundleLocation,
    composition,
    inputProps,
    fps: composition.fps,
  });

  console.log("\nLayout QA log:");
  for (const entry of log) {
    console.log(`  action "${entry.actionId}": passed=${entry.passed} adjustmentApplied=${entry.adjustmentApplied} cost=$${entry.costUsd.toFixed(4)}`);
    if (entry.issues.length > 0) console.log(`    issues: ${entry.issues.join("; ")}`);
  }

  console.log(`\nAfter: action has ${sceneDocument.actions[0]!.decorations!.length} decorations`);

  if (sceneDocument.actions[0]!.decorations!.length < 12) {
    console.log("\nPASS: the QA loop correctly dropped at least one decoration from the over-decorated scene.");
  } else {
    console.log("\nNo decoration was dropped — either the model judged it acceptable, or something needs tuning.");
  }
}

main().catch((err) => {
  console.error("test-layout-qa failed:", err);
  process.exitCode = 1;
});
