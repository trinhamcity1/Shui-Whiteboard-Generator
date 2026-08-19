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

const DOC = {
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
        title: "HIERARCHY OF LAW",
        topLabel: "CONSTITUTION",
        tiers: [
          { label: "FEDERAL", insetAssetId: "prop-checkmark" },
          { label: "STATE", insetAssetId: "prop-lightbulb" },
          { label: "LOCAL" },
        ],
        bottomBanner: "UNITED STATES",
        leftCharacterAssetId: "civics-judge-explaining",
        rightCharacterAssetId: "civics-officer-explaining",
      },
    },
  ],
};

async function main() {
  const outputDir = path.join(ROOT, "output");
  await fs.mkdir(outputDir, { recursive: true });

  const sceneDocument = parseSceneDocument(DOC);
  await resolveImages(sceneDocument, { orientation: "vertical" });
  await inlineRemoteImagesForLocalDev(sceneDocument);

  const bundleLocation = await bundle({ entryPoint: path.join(ROOT, "src/render/index.ts") });
  const inputProps = { sceneDocument, audioFileName: "none.mp3", totalDurationSeconds: 6 };
  const composition = await selectComposition({ serveUrl: bundleLocation, id: "SceneRenderer", inputProps });

  const outPath = path.join(outputDir, "sketchdiagram-inset-test.png");
  await renderStill({ composition, serveUrl: bundleLocation, output: outPath, frame: 60, inputProps });
  console.log(`   still -> ${outPath}`);
}

main().catch((err) => {
  console.error("render-inset-test failed:", err);
  process.exitCode = 1;
});
