import "dotenv/config";
import { previewScenePlan, printScenePlanPreview } from "../src/pipeline/previewPlan";

// Usage: npx tsx scripts/preview-script.ts "your narration script here"
// Or edit SCRIPT below and run with no argument.
const SCRIPT = process.argv[2] ?? "";

async function main() {
  if (!SCRIPT.trim()) {
    console.error('Usage: npx tsx scripts/preview-script.ts "your narration script"');
    process.exit(1);
  }
  const preview = await previewScenePlan(SCRIPT);
  printScenePlanPreview(preview);
}

main().catch((err) => {
  console.error("FULL ERROR:", err);
  process.exit(1);
});
