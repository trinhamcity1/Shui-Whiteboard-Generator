import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { parseSceneDocument } from "../src/schema/scene";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const FLOWCHART_DOC = {
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
        diagramType: "flowchart",
        title: "How Water Moves Through the Cycle",
        tiers: [
          { label: "Evaporation" },
          { label: "Condensation" },
          { label: "Precipitation" },
          { label: "Collection" },
        ],
        bottomBanner: "Water always moving and recycling",
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
      type: "sketchDiagram",
      atSeconds: 0,
      durationSeconds: 5,
      sketchDiagram: {
        diagramType: "comparison",
        title: "Federal vs. State Law",
        tiers: [
          { label: "Applies to the whole country" },
          { label: "Applies within one state" },
        ],
      },
    },
  ],
};

async function main() {
  const outputDir = path.join(ROOT, "output");
  await fs.mkdir(outputDir, { recursive: true });
  const bundleLocation = await bundle({ entryPoint: path.join(ROOT, "src/render/index.ts") });

  for (const [name, doc] of [["flowchart", FLOWCHART_DOC], ["comparison", COMPARISON_DOC]] as const) {
    const sceneDocument = parseSceneDocument(doc);
    const inputProps = { sceneDocument, audioFileName: "none.mp3", totalDurationSeconds: 6 };
    const composition = await selectComposition({ serveUrl: bundleLocation, id: "SceneRenderer", inputProps });
    const outPath = path.join(outputDir, `diagramtype-${name}.png`);
    await renderStill({ composition, serveUrl: bundleLocation, output: outPath, frame: 60, inputProps });
    console.log(`   still -> ${outPath}`);
  }
}

main().catch((err) => {
  console.error("render-diagramtype-stills failed:", err);
  process.exitCode = 1;
});
