import { listAllLibraryAssets } from "./registryLookup";
import { updateLocalLibraryAsset } from "./localRegistry";
import { runQuarantineCheck } from "./quarantine";
import { createLibraryAsset, isFirestoreKnownUnreachable, markFirestoreUnreachable } from "../../storage/firestore";

export interface PromotionResult {
  reviewed: number;
  promoted: number;
  costUsd: number;
  log: string[]; // one line per reviewed asset — the CLI script prints these verbatim
}

/**
 * Layer 2 step 4's actual promotion sweep, factored out of
 * scripts/promote-quarantined-assets.ts so it can run two ways: manually
 * via that script, or automatically as part of a real render (see
 * renderJob.ts) — the same logic either way, no drift between them.
 *
 * Sweeps every "pending" asset across the whole library (not just ones
 * this particular call site generated), runs the automated quarantine
 * check against each one's actual stored image, and promotes only on a
 * pass. A failed check leaves the asset "pending" for a later sweep to
 * pick back up, rather than being silently dropped or promoted anyway.
 */
export async function promotePendingAssets(opts: { apiKey?: string } = {}): Promise<PromotionResult> {
  const all = await listAllLibraryAssets();
  const pending = all.filter((a) => a.quarantineStatus === "pending");

  const log: string[] = [];
  let promoted = 0;
  let costUsd = 0;

  for (const asset of pending) {
    try {
      const imageResponse = await fetch(asset.imageUrl);
      const buffer = Buffer.from(await imageResponse.arrayBuffer());

      const result = await runQuarantineCheck(buffer, { apiKey: opts.apiKey, requireTransparency: asset.role !== "scene" });
      costUsd += result.costUsd;

      if (result.passed) {
        if (isFirestoreKnownUnreachable()) {
          updateLocalLibraryAsset(asset.id, { quarantineStatus: "promoted" });
        } else {
          try {
            await createLibraryAsset({ ...asset, quarantineStatus: "promoted" });
          } catch {
            markFirestoreUnreachable();
            updateLocalLibraryAsset(asset.id, { quarantineStatus: "promoted" });
          }
        }
        promoted++;
        log.push(`  ${asset.id}... promoted`);
      } else {
        log.push(`  ${asset.id}... still pending — ${result.reasons.join(" ")}`);
      }
    } catch (err) {
      // One malformed/unreachable asset shouldn't abort review of every
      // other pending asset in the sweep — leave it pending and move on,
      // same as a normal quarantine-check failure.
      log.push(`  ${asset.id}... still pending — check failed: ${(err as Error).message}`);
    }
  }

  return { reviewed: pending.length, promoted, costUsd, log };
}
