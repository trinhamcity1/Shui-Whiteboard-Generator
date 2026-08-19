import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { detectAnchors } from "../src/images/assetLibrary/anchorDetection";

// WS3 item 3 (attachment poses) needs at least one real v1-manifest asset
// with a detected "attachment" anchor to exercise end to end — the v1
// manifest never ran through detectAnchors the way Layer 2's auto-expanded
// assets do (generate-v1-library.ts predates that machinery). One-off:
// run it on specific ids and patch their registry entries in place.

async function main() {
  const ids = process.argv.slice(2);
  if (ids.length === 0) throw new Error("Pass at least one asset id.");

  const registryPath = path.join(process.cwd(), "style-model-candidates", "v1-library-registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf-8")) as Array<Record<string, unknown>>;

  for (const id of ids) {
    const idx = registry.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`No registry entry for "${id}".`);
    const localPath = registry[idx]!.localPath as string;
    const buffer = fs.readFileSync(localPath);

    const result = await detectAnchors(buffer);
    registry[idx] = { ...registry[idx], anchors: result.anchors };
    console.log(`${id}: ${JSON.stringify(result.anchors)} ($${result.costUsd.toFixed(4)})`);
  }

  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  console.log(`\nRegistry updated: ${registryPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
