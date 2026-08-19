import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { parseSceneDocument, type DecorationSpec } from "../src/schema/scene";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// A grid of every decoration kind, all revealAtSeconds: 0 (instant showcase,
// not a testing-the-timing render) — a direct visual check that each
// component actually draws something recognizable, not just typechecks.
const decorations: DecorationSpec[] = [
  { kind: "arrowCurved", x: 60, y: 100, toX: 260, toY: 180, color: "#e03c31" },
  { kind: "arrowStraight", x: 60, y: 240, toX: 260, toY: 240, color: "#1d1d1b" },
  { kind: "arrowJagged", x: 60, y: 340, toX: 260, toY: 380, color: "#e03c31" },
  { kind: "arrowDashed", x: 60, y: 460, toX: 260, toY: 460, color: "#1d1d1b" },

  { kind: "xMark", x: 380, y: 130, size: 40, color: "#e03c31" },
  { kind: "checkmark", x: 480, y: 130, size: 40, color: "#7cb65c" },
  { kind: "radiatingStrokes", x: 380, y: 240, size: 40 },
  { kind: "circledScribble", x: 480, y: 340, size: 90, color: "#e03c31" },
  { kind: "underlineSwash", x: 360, y: 440, width: 140, color: "#e03c31" },
  { kind: "sparkle", x: 400, y: 500, size: 18, color: "#f49b4a" },
  { kind: "sparkle", x: 440, y: 480, size: 12, color: "#54b8e5" },
  { kind: "motionDashes", x: 560, y: 500, size: 40 },

  { kind: "bannerRibbon", x: 660, y: 80, width: 260, height: 70, color: "#1d1d1b", fill: "#ffffff" },
  { kind: "scroll", x: 700, y: 200, width: 140, height: 190, hasSeal: true },
  { kind: "thoughtBubble", x: 660, y: 440, width: 160, height: 100, fill: "#ffffff" },
  { kind: "speechBubble", x: 850, y: 440, width: 160, height: 90, fill: "#ffffff" },
  { kind: "wobbleFrame", x: 660, y: 620, width: 220, height: 140, color: "#1d1d1b" },
  { kind: "tornPaperEdge", x: 660, y: 800, width: 260, height: 30, fill: "#e8d9b0" },

  { kind: "groundTufts", x: 60, y: 950, width: 220, color: "#7cb65c" },
  { kind: "bushes", x: 60, y: 1050, width: 220, color: "#7cb65c" },
  { kind: "shadowEllipse", x: 200, y: 1130, width: 160 },
];

const DOC = {
  schemaVersion: 1,
  narrationScript: "test",
  voice: "x",
  styleVariant: "classic-whiteboard",
  orientation: "vertical",
  actions: [
    { id: "1", type: "titleCard", atSeconds: 0, durationSeconds: 5, text: "Decoration Showcase", decorations },
  ],
};

async function main() {
  const outputDir = path.join(ROOT, "output");
  await fs.mkdir(outputDir, { recursive: true });

  const sceneDocument = parseSceneDocument(DOC);
  const bundleLocation = await bundle({ entryPoint: path.join(ROOT, "src/render/index.ts") });
  const inputProps = { sceneDocument, audioFileName: "none.mp3", totalDurationSeconds: 6 };
  const composition = await selectComposition({ serveUrl: bundleLocation, id: "SceneRenderer", inputProps });

  for (const [label, frame] of [["mid-reveal", 10], ["settled", 60]] as const) {
    const outPath = path.join(outputDir, `decoration-showcase-${label}.png`);
    await renderStill({ composition, serveUrl: bundleLocation, output: outPath, frame, inputProps });
    console.log(`   still -> ${outPath}`);
  }
}

main().catch((err) => {
  console.error("render-decoration-showcase failed:", err);
  process.exitCode = 1;
});
