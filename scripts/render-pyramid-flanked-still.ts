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
      type: "composition",
      atSeconds: 0,
      durationSeconds: 6,
      composition: {
        templateId: "pyramid-flanked",
        title: "HIERARCHY OF LAW",
        slots: {
          tier1: { label: "FEDERAL" },
          tier2: { label: "STATE" },
          tier3: { label: "LOCAL" },
          leftCharacter: { assetId: "civics-judge-explaining" },
          rightCharacter: { assetId: "civics-officer-explaining" },
        },
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
  const inputProps = { sceneDocument, audioFileName: "none.mp3", totalDurationSeconds: 7 };
  const composition = await selectComposition({ serveUrl: bundleLocation, id: "SceneRenderer", inputProps });

  const outPath = path.join(outputDir, "composition-pyramid-flanked.png");
  await renderStill({ composition, serveUrl: bundleLocation, output: outPath, frame: 60, inputProps });
  console.log(`   still -> ${outPath}`);
}

main().catch((err) => {
  console.error("render-pyramid-flanked-still failed:", err);
  process.exitCode = 1;
});
