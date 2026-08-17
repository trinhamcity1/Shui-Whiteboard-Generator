import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { selectComposition } from "@remotion/renderer";
import { resolveImages } from "../src/images/resolveImages";
import { inlineRemoteImagesForLocalDev } from "../src/pipeline/localDevInlining";
import { parseSceneDocument } from "../src/schema/scene";
import { runLayoutQA } from "../src/pipeline/layoutQA";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Revision-3 doc Verify #6's other two constructed cases (the
// over-decoration case is already covered by test-layout-qa.ts): one
// overlap case and one dead-zone case. Real test: does the QA loop
// actually flag each and apply its one bounded correction?
//
// KNOWN GAP (found running this): the dead-zone case passes cleanly, but
// the overlap case does not — a large opaque decoration was placed
// directly over two pyramid-tier labels (confirmed with a debug still:
// the labels are completely blanked out, an unambiguous visual overlap).
// The critique described it as dead-zone/low-coverage instead and applied
// no correction. Tried tightening layoutQA.ts's rubric to make overlap an
// explicit top priority — this did NOT fix overlap detection (still
// missed it), and turned out to be a real regression: re-run against
// test-layout-qa.ts's known-good over-decoration case with the reworded
// rubric, and it stopped reliably dropping a decoration too (the
// overlap-first framing seems to crowd out the model's attention on
// decoration-count, the same "long/reweighted instructions lose the
// model's attention on other details" pattern already seen twice
// elsewhere in this project). Reverted layoutQA.ts to its original,
// confirmed-working rubric rather than ship a net-worse prompt. The QA
// loop reliably catches over-decoration and low-coverage/dead-zone
// cases; overlap detection specifically is a real, documented gap that
// needs a more careful prompt-engineering pass, not a rushed one.

async function testOverlap() {
  // A large opaque decoration (BannerRibbon's solid panelFill) placed
  // directly on top of the pyramid's middle tier — a real, unambiguous
  // pixel overlap, unlike two transparent-background character cutouts
  // whose bounding boxes can overlap without any visible collision.
  const doc = {
    schemaVersion: 1,
    narrationScript: "test",
    voice: "x",
    styleVariant: "classic-whiteboard",
    orientation: "vertical",
    actions: [
      {
        id: "1",
        type: "sketchDiagram",
        atSeconds: 0,
        durationSeconds: 5,
        sketchDiagram: {
          diagramType: "pyramid",
          title: "OVERLAP TEST",
          tiers: [{ label: "FEDERAL" }, { label: "STATE" }, { label: "LOCAL" }],
        },
        decorations: [{ kind: "bannerRibbon", x: 260, y: 370, width: 460, height: 120 }],
      },
    ],
  };

  const sceneDocument = parseSceneDocument(doc);
  const bundleLocation = await bundle({ entryPoint: path.join(ROOT, "src/render/index.ts") });
  const inputProps = { sceneDocument, audioFileName: "none.mp3", totalDurationSeconds: 6 };
  const composition = await selectComposition({ serveUrl: bundleLocation, id: "SceneRenderer", inputProps });

  const before = sceneDocument.actions[0]!.decorations!.length;
  const log = await runLayoutQA({ sceneDocument, bundleLocation, composition, inputProps, fps: composition.fps });
  const after = sceneDocument.actions[0]!.decorations!.length;

  console.log("--- Overlap case ---");
  for (const entry of log) {
    console.log(`  passed=${entry.passed} adjustmentApplied=${entry.adjustmentApplied} cost=$${entry.costUsd.toFixed(4)}`);
    if (entry.issues.length > 0) console.log(`  issues: ${entry.issues.join("; ")}`);
  }
  console.log(`  decorations before=${before} after=${after}`);
  console.log(
    log.some((e) => !e.passed)
      ? "PASS: QA loop flagged the overlap.\n"
      : "No issue flagged — either judged acceptable or needs tuning.\n",
  );
}

async function testDeadZone() {
  // A hero-backdrop composition with only a small backdrop image and
  // nothing else — leaves most of a 1920px-tall canvas empty.
  const doc = {
    schemaVersion: 1,
    narrationScript: "test",
    voice: "x",
    styleVariant: "classic-whiteboard",
    orientation: "vertical",
    actions: [
      {
        id: "1",
        type: "composition",
        atSeconds: 0,
        durationSeconds: 5,
        composition: {
          templateId: "hero-backdrop",
          title: "DEAD ZONE TEST",
          slots: {
            backdrop: { assetId: "prop-checkmark" },
          },
        },
      },
    ],
  };

  const sceneDocument = parseSceneDocument(doc);
  await resolveImages(sceneDocument, { orientation: "vertical" });
  await inlineRemoteImagesForLocalDev(sceneDocument);

  const bundleLocation = await bundle({ entryPoint: path.join(ROOT, "src/render/index.ts") });
  const inputProps = { sceneDocument, audioFileName: "none.mp3", totalDurationSeconds: 6 };
  const composition = await selectComposition({ serveUrl: bundleLocation, id: "SceneRenderer", inputProps });

  const log = await runLayoutQA({ sceneDocument, bundleLocation, composition, inputProps, fps: composition.fps });

  console.log("--- Dead-zone case ---");
  for (const entry of log) {
    console.log(`  passed=${entry.passed} adjustmentApplied=${entry.adjustmentApplied} cost=$${entry.costUsd.toFixed(4)}`);
    if (entry.issues.length > 0) console.log(`  issues: ${entry.issues.join("; ")}`);
  }
  console.log(
    log.some((e) => !e.passed)
      ? "PASS: QA loop flagged the dead zone / low coverage.\n"
      : "No issue flagged — either judged acceptable or needs tuning.\n",
  );
}

async function main() {
  await testOverlap();
  await testDeadZone();
}

main().catch((err) => {
  console.error("test-layout-qa-more-cases failed:", err);
  process.exitCode = 1;
});
