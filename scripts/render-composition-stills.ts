import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { parseSceneDocument } from "../src/schema/scene";
import { resolveImages } from "../src/images/resolveImages";
import { inlineRemoteImagesForLocalDev } from "../src/pipeline/localDevInlining";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// All assetId-backed — $0, no live generation — this is purely a layout
// and per-slot-reveal-timing check for the three new templates, using
// real v1-library assets already on hand.

const HERO_DOC = {
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
      durationSeconds: 6,
      composition: {
        templateId: "hero-backdrop",
        title: "The Courts Interpret the Law",
        slots: {
          backdrop: { assetId: "civics-prop-government-building" },
          character: { assetId: "civics-judge-explaining", revealAtSeconds: 1.5 },
          caption: { label: "Judges decide what the law means.", revealAtSeconds: 3 },
        },
      },
    },
  ],
};

const STORYBOARD_DOC = {
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
      durationSeconds: 6,
      composition: {
        templateId: "storyboard-4panel",
        title: "How a Bill Becomes Law",
        slots: {
          panel1: { assetId: "prop-book", label: "A bill is written" },
          panel2: { assetId: "prop-gear", label: "Committees review it", revealAtSeconds: 1 },
          panel3: { assetId: "civics-prop-gavel", label: "Both chambers vote", revealAtSeconds: 2 },
          panel4: { assetId: "civics-prop-constitution-scroll", label: "The President signs it", revealAtSeconds: 3 },
        },
      },
    },
  ],
};

const COMPARISON_DOC = {
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
      durationSeconds: 6,
      composition: {
        templateId: "comparison-2box",
        title: "Voting vs. Serving on a Jury",
        slots: {
          left: { assetId: "civics-prop-ballot-box", label: "Voting" },
          right: { assetId: "civics-prop-gavel", label: "Jury duty", revealAtSeconds: 1.5 },
        },
      },
    },
  ],
};

async function renderScenePair(name: string, doc: unknown, bundleLocation: string, outputDir: string) {
  const sceneDocument = parseSceneDocument(doc);
  await resolveImages(sceneDocument, { orientation: "vertical" });
  await inlineRemoteImagesForLocalDev(sceneDocument);
  const inputProps = { sceneDocument, audioFileName: "none.mp3", totalDurationSeconds: 7 };
  const composition = await selectComposition({ serveUrl: bundleLocation, id: "SceneRenderer", inputProps });

  for (const [label, frame] of [["early", 15], ["late", 150]] as const) {
    const outPath = path.join(outputDir, `composition-${name}-${label}.png`);
    await renderStill({ composition, serveUrl: bundleLocation, output: outPath, frame, inputProps });
    console.log(`   still -> ${outPath}`);
  }
}

async function main() {
  const outputDir = path.join(ROOT, "output");
  await fs.mkdir(outputDir, { recursive: true });
  const bundleLocation = await bundle({ entryPoint: path.join(ROOT, "src/render/index.ts") });

  await renderScenePair("hero", HERO_DOC, bundleLocation, outputDir);
  await renderScenePair("storyboard", STORYBOARD_DOC, bundleLocation, outputDir);
  await renderScenePair("comparison", COMPARISON_DOC, bundleLocation, outputDir);
}

main().catch((err) => {
  console.error("render-composition-stills failed:", err);
  process.exitCode = 1;
});
