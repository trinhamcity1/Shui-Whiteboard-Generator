import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { resolveImages } from "../src/images/resolveImages";
import { inlineRemoteImagesForLocalDev } from "../src/pipeline/localDevInlining";
import { parseSceneDocument } from "../src/schema/scene";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Revision-3 Workstream 3 item 3 real test: a character composed via
// attachTo, standing at civics-prop-government-building's detected
// "attachment" anchor (its front steps) instead of a fixed floating box.

async function main() {
  const sceneDocument = parseSceneDocument({
    schemaVersion: 1,
    narrationScript: "placeholder",
    voice: "x",
    styleVariant: "classic-whiteboard",
    orientation: "vertical",
    actions: [
      {
        id: "hero",
        type: "composition",
        atSeconds: 0,
        durationSeconds: 6,
        composition: {
          templateId: "hero-backdrop",
          title: "STEPS OF GOVERNMENT",
          slots: {
            backdrop: { assetId: "civics-prop-government-building", revealAtSeconds: 0 },
            character: { assetId: "civics-officer-explaining", attachTo: "backdrop", revealAtSeconds: 0.5 },
            caption: { label: "An officer explains the process", revealAtSeconds: 1 },
          },
        },
      },
    ],
  });

  await resolveImages(sceneDocument, { orientation: "vertical" });
  await inlineRemoteImagesForLocalDev(sceneDocument);

  const bundleLocation = await bundle({ entryPoint: path.join(ROOT, "src/render/index.ts") });
  const inputProps = { sceneDocument, audioFileName: "none.mp3", totalDurationSeconds: 6 };
  const composition = await selectComposition({ serveUrl: bundleLocation, id: "SceneRenderer", inputProps });

  const outputLocation = path.join(ROOT, "output", "attachment-pose-test.png");
  await renderStill({ composition, serveUrl: bundleLocation, output: outputLocation, frame: Math.round(3 * composition.fps), inputProps });
  console.log(`-> ${outputLocation}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
