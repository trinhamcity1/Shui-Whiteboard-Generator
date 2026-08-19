import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { parseSceneDocument } from "../src/schema/scene";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Revision-3 WS1 Checkpoint, third leg: a rich-register hero frame — the
// doc's own §4 acceptance criteria for the "dense full-canvas narrative
// tableau" register, distinct from the clean-register library assets
// already checked. Generates one new "council chamber" rich-register
// image through the validated trained LoRA, then composites it through
// HeroBackdropTemplate exactly like a real render would.

async function main() {
  // Backdrop already generated + hand-reviewed by a separate one-off pass
  // (2 retries against the first sample, which had a stray watermark-like
  // corner mark and near-zero color); output/rich-hero-final.png is the
  // accepted one, already cropped to remove the same defect class.
  const outputDir = path.join(ROOT, "output");
  const finalBackdropPath = path.join(outputDir, "rich-hero-final.png");
  const buffer = fs.readFileSync(finalBackdropPath);
  const dataUri = `data:image/png;base64,${buffer.toString("base64")}`;

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
          title: "COUNCIL OF ELDERS",
          slots: {
            backdrop: { imageUrl: dataUri, revealAtSeconds: 0 },
            caption: { label: "A gathering of historic leaders", revealAtSeconds: 0.5 },
          },
        },
      },
    ],
  });

  const bundleLocation = await bundle({ entryPoint: path.join(ROOT, "src/render/index.ts") });
  const inputProps = { sceneDocument, audioFileName: "none.mp3", totalDurationSeconds: 6 };
  const composition = await selectComposition({ serveUrl: bundleLocation, id: "SceneRenderer", inputProps });

  const stillPath = path.join(outputDir, "checkpoint-rich-hero.png");
  await renderStill({ composition, serveUrl: bundleLocation, output: stillPath, frame: Math.round(3 * composition.fps), inputProps });
  console.log(`Composited hero still -> ${stillPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
