import "dotenv/config";
import { parseSceneDocument } from "../src/schema/scene";
import { resolveImages } from "../src/images/resolveImages";
import { getImageProvider } from "../src/images/index";
import { listLocalAutoExpandedAssets, updateLocalLibraryAsset } from "../src/images/assetLibrary/localRegistry";
import { runQuarantineCheck } from "../src/images/assetLibrary/quarantine";

// Layer 2 end-to-end smoke test, without paying for TTS/render: a genuinely
// new imageConcept (not in the v1 manifest) should generate through the
// trained model and land in quarantine; after promotion, a near-duplicate
// concept should reuse it for $0 via semantic match instead of generating
// again. A still-pending (unpromoted) asset should NOT be reused.

function buildDoc(concept: string) {
  return parseSceneDocument({
    schemaVersion: 1,
    narrationScript: "Test narration for Layer 2 validation.",
    voice: "21m00Tcm4TlvDq8ikWAM",
    styleVariant: "classic-whiteboard",
    orientation: "vertical",
    actions: [
      { id: "1", type: "fullBleedGraphic", atSeconds: 0, durationSeconds: 3, imageConcept: concept },
    ],
  });
}

async function main() {
  const provider = getImageProvider("trained-style");
  let totalCost = 0;

  console.log("Step 1: genuinely new concept — should generate + quarantine.\n");
  const firstConcept = "a red bicycle leaning against a wooden fence";
  const doc1 = buildDoc(firstConcept);
  const result1 = await resolveImages(doc1, { provider, orientation: "vertical" });
  totalCost += result1.costUsd;
  console.log(`  imagesGenerated=${result1.imagesGenerated} cacheHits=${result1.cacheHits} cost=$${result1.costUsd.toFixed(4)}`);
  console.log(`  imageUrl -> ${doc1.actions[0]!.imageUrl}`);
  console.log(`  assetId  -> ${doc1.actions[0]!.assetId}`);

  const newAssetId = doc1.actions[0]!.assetId!;
  const afterFirst = listLocalAutoExpandedAssets();
  const newRecord = afterFirst.find((a) => a.id === newAssetId);
  console.log(`  registry record: origin=${newRecord?.origin} quarantineStatus=${newRecord?.quarantineStatus}`);
  console.log(`  labelAnchor=${JSON.stringify(newRecord?.labelAnchor)} dominantColor=${newRecord?.dominantColor}\n`);

  if (result1.imagesGenerated !== 1) throw new Error("Expected the first concept to be a real generation (cache miss).");
  if (newRecord?.quarantineStatus !== "pending") {
    throw new Error(`Expected the new asset to start "pending", got "${newRecord?.quarantineStatus}".`);
  }

  console.log("Step 2: near-duplicate concept while still pending — should NOT reuse (not yet promoted).\n");
  const doc2 = buildDoc("a red bike parked next to a fence");
  const result2 = await resolveImages(doc2, { provider, orientation: "vertical" });
  totalCost += result2.costUsd;
  console.log(`  imagesGenerated=${result2.imagesGenerated} cacheHits=${result2.cacheHits} cost=$${result2.costUsd.toFixed(4)}`);
  if (result2.cacheHits !== 0) {
    throw new Error("A still-pending asset was reused before promotion — quarantine gate is broken.");
  }
  console.log("  Correctly generated fresh (quarantine gate held).\n");

  console.log("Step 3: run the quarantine check + promote both pending assets.\n");
  for (const id of [newAssetId, doc2.actions[0]!.assetId!]) {
    const record = listLocalAutoExpandedAssets().find((a) => a.id === id);
    if (!record) continue;
    const imageResponse = await fetch(record.imageUrl);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const check = await runQuarantineCheck(buffer);
    totalCost += check.costUsd;
    console.log(`  ${id}: passed=${check.passed}${check.reasons.length ? ` (${check.reasons.join(" ")})` : ""}`);
    if (check.passed) updateLocalLibraryAsset(id, { quarantineStatus: "promoted" });
  }

  console.log("\nStep 4: near-duplicate concept, now that a match exists and is promoted — should reuse for $0.\n");
  const doc3 = buildDoc("a red bicycle propped up against a fence");
  const result3 = await resolveImages(doc3, { provider, orientation: "vertical" });
  totalCost += result3.costUsd;
  console.log(`  imagesGenerated=${result3.imagesGenerated} cacheHits=${result3.cacheHits} cost=$${result3.costUsd.toFixed(4)}`);
  console.log(`  matched assetId -> ${doc3.actions[0]!.assetId}`);
  if (result3.cacheHits !== 1) {
    console.warn("  WARNING: expected a semantic-match reuse here but got a fresh generation instead.");
  } else {
    console.log("  Correctly reused the promoted asset via semantic match.");
  }

  console.log(`\nTotal test cost: $${totalCost.toFixed(4)}`);
}

main().catch((err) => {
  console.error("test-layer2-autoexpand failed:", err);
  process.exit(1);
});
