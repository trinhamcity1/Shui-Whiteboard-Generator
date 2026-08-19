import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { StyleCandidate } from "../src/images/styleModel/types";

// Tiles a candidate batch into a labeled grid PNG for human curation —
// register-3 candidates carry a register (clean/rich) and an optional
// pairId, both shown on the label so the cross-register acceptance test
// (Part I §4) is easy to eyeball directly on the sheet.

function parseArg(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found?.slice(prefix.length);
}

async function main() {
  const args = process.argv.slice(2);
  const pool = parseArg(args, "pool") ?? "default";
  const candidatesDir = path.join(process.cwd(), "style-model-candidates", pool);
  const manifestPath = path.join(candidatesDir, "manifest.json");
  const candidates = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as StyleCandidate[];

  const TILE = 260;
  const LABEL_H = 46;
  const CELL_W = TILE;
  const CELL_H = TILE + LABEL_H;
  const COLS = 8;
  const rows = Math.ceil(candidates.length / COLS);
  const sheetW = COLS * CELL_W;
  const sheetH = rows * CELL_H;

  const composites: Array<{ input: Buffer; left: number; top: number }> = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!;
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * CELL_W;
    const y = row * CELL_H;

    const thumb = await sharp(c.localPath).resize(TILE, TILE, { fit: "cover" }).png().toBuffer();
    composites.push({ input: thumb, left: x, top: y });

    const registerTag = c.register ? `[${c.register}]` : "";
    const pairTag = c.pairId ? ` ${c.pairId}` : "";
    const label = `${i + 1}. ${c.subject}`.slice(0, 34);
    const svg = `<svg width="${TILE}" height="${LABEL_H}">
      <rect width="100%" height="100%" fill="#111"/>
      <text x="4" y="16" font-size="11" fill="#fff" font-family="sans-serif">${escapeXml(label)}</text>
      <text x="4" y="32" font-size="10" fill="#9c9" font-family="sans-serif">${escapeXml(registerTag + pairTag)}</text>
    </svg>`;
    composites.push({ input: Buffer.from(svg), left: x, top: y + TILE });
  }

  const outPath = path.join(candidatesDir, "contact-sheet.png");
  await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: "#222" } })
    .composite(composites)
    .png()
    .toFile(outPath);

  console.log(`Contact sheet (${candidates.length} candidates) -> ${outPath}`);

  const cleanCount = candidates.filter((c) => c.register === "clean").length;
  const richCount = candidates.filter((c) => c.register === "rich").length;
  console.log(`Register split: ${cleanCount} clean / ${richCount} rich`);
  const pairIds = [...new Set(candidates.map((c) => c.pairId).filter(Boolean))];
  console.log(`Same-subject pairs present: ${pairIds.join(", ") || "none"}`);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

main().catch((err) => {
  console.error("build-candidate-contact-sheet failed:", err);
  process.exit(1);
});
