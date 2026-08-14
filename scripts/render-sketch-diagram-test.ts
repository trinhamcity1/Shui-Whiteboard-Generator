import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Proof-of-concept render for the SketchDiagram component (see
// src/render/components/SketchDiagram.tsx) — mimics the Golpo "Hierarchy of
// Law" reference frame with rough.js shapes, real text labels, and two of
// the storybook style-model candidates standing in for judge/officer. Not
// wired into the real pipeline; just answers "is this composite possible"
// before the sketchDiagram action type gets built for real.
async function main() {
  const outputDir = path.join(ROOT, "output");
  await fs.mkdir(outputDir, { recursive: true });
  const outputLocation = path.join(outputDir, "sketch-diagram-test.png");

  console.log("Bundling Remotion project...");
  const bundleLocation = await bundle({
    entryPoint: path.join(ROOT, "src/render/index.ts"),
  });

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "SketchDiagramTest",
  });

  console.log("Rendering still frame...");
  await renderStill({
    composition,
    serveUrl: bundleLocation,
    output: outputLocation,
  });

  console.log(`Done -> ${outputLocation}`);
}

main().catch((err) => {
  console.error("render-sketch-diagram-test failed:", err);
  process.exitCode = 1;
});
