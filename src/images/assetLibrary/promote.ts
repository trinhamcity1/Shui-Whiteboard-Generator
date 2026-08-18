import { listAllLibraryAssets } from "./registryLookup";
import { updateLocalLibraryAsset, removeLocalLibraryAsset } from "./localRegistry";
import { runQuarantineCheck } from "./quarantine";
import {
  createLibraryAsset,
  deleteLibraryAsset,
  isFirestoreKnownUnreachable,
  markFirestoreUnreachable,
} from "../../storage/firestore";
import { deleteObjectFromR2 } from "../../storage/r2";

export interface PromotionResult {
  reviewed: number;
  promoted: number;
  dropped: number;
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
 * pass. A failed check drops the asset outright — R2 object and registry
 * record both deleted — rather than leaving it "pending" forever with no
 * path back; a bad generation that already failed the check once has no
 * reason to pass on a later sweep, so keeping it around only wastes R2
 * storage. Never spent on a v1-manifest asset (see registryLookup's
 * origin filter) — only auto-expanded assets ever reach "pending".
 */
export async function promotePendingAssets(opts: { apiKey?: string } = {}): Promise<PromotionResult> {
  const all = await listAllLibraryAssets();
  const pending = all.filter((a) => a.quarantineStatus === "pending");

  const log: string[] = [];
  let promoted = 0;
  let dropped = 0;
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
        if (asset.r2Key) {
          await deleteObjectFromR2({ key: asset.r2Key });
        }
        if (isFirestoreKnownUnreachable()) {
          removeLocalLibraryAsset(asset.id);
        } else {
          try {
            await deleteLibraryAsset(asset.id);
          } catch {
            markFirestoreUnreachable();
            removeLocalLibraryAsset(asset.id);
          }
        }
        dropped++;
        log.push(`  ${asset.id}... dropped — ${result.reasons.join(" ")}`);
      }
    } catch (err) {
      // One malformed/unreachable asset shouldn't abort review of every
      // other pending asset in the sweep — leave it pending and move on.
      // Only an actual failed check (above) drops an asset; an error here
      // means the check itself never ran, so there's nothing to act on yet.
      log.push(`  ${asset.id}... still pending — check failed: ${(err as Error).message}`);
    }
  }

  return { reviewed: pending.length, promoted, dropped, costUsd, log };
}
