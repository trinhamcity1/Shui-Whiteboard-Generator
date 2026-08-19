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

  for (const s of [3, 10]) {
    const outPath = path.join(outputDir, `water-cycle-v2-still-${s}s.png`);
    await renderStill({ composition, serveUrl: bundleLocation, output: outPath, frame: Math.round(s * 30), inputProps });
    console.log(`   still -> ${outPath}`);
  }
}

main().catch((err) => {
  console.error("render-water-cycle-stills2 failed:", err);
  process.exitCode = 1;
});
