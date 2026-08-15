import "dotenv/config";
import { listLocalAutoExpandedAssets, updateLocalLibraryAsset } from "../src/images/assetLibrary/localRegistry";
import { runQuarantineCheck } from "../src/images/assetLibrary/quarantine";
import { getLibraryAsset, createLibraryAsset } from "../src/storage/firestore";

// Layer 2 step 4, run out-of-band from any single render: sweep every
// "pending" auto-expanded asset, run the automated quarantine check against
// its actual stored image, and promote it into the shared registry only on
// a pass. A failed check leaves the asset "pending" — visible in this
// script's output for manual follow-up — rather than being silently
// dropped or promoted anyway.

async function main() {
  const pending = listLocalAutoExpandedAssets().filter((a) => a.quarantineStatus === "pending");
  if (pending.length === 0) {
    console.log("No pending auto-expanded assets to review.");
    return;
  }

  console.log(`Reviewing ${pending.length} pending asset(s)...\n`);
  let promoted = 0;
  let totalCost = 0;

  for (const asset of pending) {
    process.stdout.write(`  ${asset.id}... `);
    const imageResponse = await fetch(asset.imageUrl);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());

    const result = await runQuarantineCheck(buffer);
    totalCost += result.costUsd;

    if (result.passed) {
      updateLocalLibraryAsset(asset.id, { quarantineStatus: "promoted" });
      try {
        const remote = await getLibraryAsset(asset.id);
        if (!remote) await createLibraryAsset({ ...asset, quarantineStatus: "promoted" });
      } catch {
        // Firestore unreachable — the local registry update above is the
        // real write in this environment.
      }
      promoted++;
      console.log("promoted");
    } else {
      console.log(`still pending — ${result.reasons.join(" ")}`);
    }
  }

  console.log(`\nPromoted ${promoted}/${pending.length}. Quarantine-check cost: $${totalCost.toFixed(4)}.`);
}

main().catch((err) => {
  console.error("promote-quarantined-assets failed:", err);
  process.exit(1);
});
