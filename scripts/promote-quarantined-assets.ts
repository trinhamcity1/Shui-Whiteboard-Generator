import "dotenv/config";
import { promotePendingAssets } from "../src/images/assetLibrary/promote";

// Manual entry point for promotePendingAssets — the same sweep also runs
// automatically after any real render that generated new assets (see
// renderJob.ts). Kept as a standalone script for an on-demand full-library
// sweep (e.g. after changing the quarantine check's own rules).

async function main() {
  const result = await promotePendingAssets();
  if (result.reviewed === 0) {
    console.log("No pending auto-expanded assets to review.");
    return;
  }
  console.log(`Reviewing ${result.reviewed} pending asset(s)...\n`);
  console.log(result.log.join("\n"));
  console.log(`\nPromoted ${result.promoted}/${result.reviewed}. Quarantine-check cost: $${result.costUsd.toFixed(4)}.`);
}

main().catch((err) => {
  console.error("promote-quarantined-assets failed:", err);
  process.exit(1);
});
