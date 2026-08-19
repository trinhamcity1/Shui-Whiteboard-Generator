import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { parseSceneDocument } from "../src/schema/scene";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

async function main() {
  const outputDir = path.join(ROOT, "output");
  const docPath = path.join(outputDir, "water-cycle-scenedoc.json");
  const raw = JSON.parse(await fs.readFile(docPath, "utf-8"));
  const sceneDocument = parseSceneDocument(raw);

  const bundleLocation = await bundle({ entryPoint: path.join(ROOT, "src/render/index.ts") });
  const totalDurationSeconds = 26.6;
  const inputProps = { sceneDocument, audioFileName: "tts-audio.mp3", totalDurationSeconds };
  const composition = await selectComposition({ serveUrl: bundleLocation, id: "SceneRenderer", inputProps });

  const stillsAtSeconds = [1, 4, 9, 15, 21];
  for (const s of stillsAtSeconds) {
    const outPath = path.join(outputDir, `water-cycle-still-${s}s.png`);
    await renderStill({
      composition,
      serveUrl: bundleLocation,
      output: outPath,
      frame: Math.round(s * 30),
      inputProps,
    });
    console.log(`   still -> ${outPath}`);
  }
}

main().catch((err) => {
  console.error("render-water-cycle-stills failed:", err);
  process.exitCode = 1;
});
