import "dotenv/config";
import path from "node:path";
import { generateCandidates } from "../src/images/styleModel/candidateGen";

// Amendment §6/§8: Plan A step 1-2. Run in stages so nothing past the
// candidates step spends money until a human has actually looked at output:
//   npm run train-style-model -- --step=candidates --count=10   (small gut-check batch)
//   npm run train-style-model -- --step=candidates --count=150  (full Plan A batch, after sign-off on the small one)
// Curation (picking the ~20 best) and training are separate steps, added
// once the candidate batch itself is approved.

function parseArg(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found?.slice(prefix.length);
}

async function main() {
  const args = process.argv.slice(2);
  const step = parseArg(args, "step") ?? "candidates";
  const count = Number(parseArg(args, "count") ?? "10");
  const pool = (parseArg(args, "pool") ?? "default") as "default" | "diagram";

  if (step !== "candidates") {
    throw new Error(
      `Step "${step}" isn't built yet. Only "candidates" is available so far — curate/train/test land after the candidate batch is reviewed.`,
    );
  }

  const apiKey = process.env.FLUX_API_KEY;
  if (!apiKey) {
    throw new Error("FLUX_API_KEY is required (fal.ai key, same one used for Phase 4 Flux generation).");
  }

  const outDir = path.join(process.cwd(), "style-model-candidates", pool);
  console.log(`Generating ${count} storybook candidates (pool=${pool}) → ${outDir}`);
  console.log(`Estimated cost: $${(count * 0.02).toFixed(2)}\n`);

  const candidates = await generateCandidates({ apiKey, count, outDir, pool });

  const totalCost = candidates.reduce((sum, c) => sum + c.costUsd, 0);
  console.log(`\nGenerated ${candidates.length} candidates for $${totalCost.toFixed(2)}.`);
  console.log(`Manifest: ${path.join(outDir, "manifest.json")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
