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

// Revision-3 WS1 Checkpoint: stills-only re-render against the newly
// retrained/regenerated v1 library, bypassing TTS entirely (ElevenLabs
// quota is exhausted this session) — the checkpoint's actual question is
// visual (does the retrained style + regenerated library close the gap
// to the reference corpus), not audio, so a real still render through
// the full resolveImages -> renderStill pipeline answers it directly.

const HIERARCHY_OF_LAW = {
  schemaVersion: 1,
  narrationScript: "placeholder",
  voice: "x",
  styleVariant: "classic-whiteboard",
  orientation: "vertical",
  actions: [
    {
      id: "diagram",
      type: "sketchDiagram",
      atSeconds: 0,
      durationSeconds: 11.5,
      sketchDiagram: {
        title: "HIERARCHY OF LAW",
        topLabel: "CONSTITUTION",
        tiers: [{ label: "FEDERAL" }, { label: "STATE" }, { label: "LOCAL" }],
        bottomBanner: "UNITED STATES",
        leftCharacterAssetId: "civics-judge-explaining",
        rightCharacterAssetId: "civics-officer-explaining",
      },
    },
  ],
};

async function renderOne(id: string, doc: typeof HIERARCHY_OF_LAW, atSeconds: number) {
  const resolvedDocument = parseSceneDocument(doc);
  await resolveImages(resolvedDocument, { orientation: resolvedDocument.orientation });
  await inlineRemoteImagesForLocalDev(resolvedDocument);

  const bundleLocation = await bundle({ entryPoint: path.join(ROOT, "src/render/index.ts") });
  const inputProps = { sceneDocument: resolvedDocument, audioFileName: "none.mp3", totalDurationSeconds: 15 };
  const composition = await selectComposition({ serveUrl: bundleLocation, id: "SceneRenderer", inputProps });

  const outputDir = path.join(ROOT, "output");
  const outputLocation = path.join(outputDir, `checkpoint-${id}.png`);
  await renderStill({
    composition,
    serveUrl: bundleLocation,
    output: outputLocation,
    frame: Math.round(atSeconds * composition.fps),
    inputProps,
  });
  console.log(`${id} -> ${outputLocation}`);
}

async function main() {
  await renderOne("hierarchy-of-law", HIERARCHY_OF_LAW, 8);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
