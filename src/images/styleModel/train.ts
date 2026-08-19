import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fal } from "@fal-ai/client";
import type { StyleModelVersion } from "./types";

const execFileAsync = promisify(execFile);

const TRIGGER_WORD = "shwgstyle";
const TRAINING_ENDPOINT = "fal-ai/flux-lora-fast-training";

async function zipDirectory(sourceDir: string, zipPath: string): Promise<void> {
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  const files = fs.readdirSync(sourceDir).filter((f) => f.endsWith(".png"));
  if (files.length === 0) {
    throw new Error(`No PNG files found in ${sourceDir} to zip for training.`);
  }
  await execFileAsync("zip", ["-j", zipPath, ...files.map((f) => path.join(sourceDir, f))]);
}

/**
 * Amendment §6 / revision-2 Layer 0: zip the curated set, upload it, kick
 * off fal.ai's hosted LoRA trainer, and wait for the trained weights.
 * TRIGGER_WORD is the token every future generation must include in its
 * prompt to invoke this specific trained look — plain Flux calls without
 * it are unaffected.
 */
export async function trainStyleModel(args: {
  apiKey: string;
  curatedDir: string;
  outDir: string;
  plan: "a" | "b" | "echo";
  /** Overrides TRIGGER_WORD — the Echo model feature needs a distinct
   * trigger word per customer model rather than every trained LoRA sharing
   * the one word the product's own default style was trained under. */
  triggerWord?: string;
}): Promise<StyleModelVersion> {
  const { apiKey, curatedDir, outDir, plan } = args;
  const triggerWord = args.triggerWord ?? TRIGGER_WORD;
  fal.config({ credentials: apiKey });

  const curatedFiles = fs.readdirSync(curatedDir).filter((f) => f.endsWith(".png"));
  console.log(`Zipping ${curatedFiles.length} curated images...`);
  const zipPath = path.join(outDir, "curated-training-set.zip");
  fs.mkdirSync(outDir, { recursive: true });
  await zipDirectory(curatedDir, zipPath);

  console.log("Uploading training set to fal.ai storage...");
  const zipBuffer = fs.readFileSync(zipPath);
  const zipUrl = await fal.storage.upload(new Blob([zipBuffer], { type: "application/zip" }));
  console.log(`Uploaded: ${zipUrl}`);

  console.log(`Submitting training job to ${TRAINING_ENDPOINT} (this takes roughly 15-30 minutes)...`);
  const result = await fal.subscribe(TRAINING_ENDPOINT, {
    input: {
      images_data_url: zipUrl,
      trigger_word: triggerWord,
    },
    logs: true,
    onQueueUpdate: (update) => {
      console.log(`[training] ${update.status}`);
    },
  });

  const rawResultPath = path.join(outDir, "training-result-raw.json");
  fs.writeFileSync(rawResultPath, JSON.stringify(result, null, 2));
  console.log(`Raw training result saved -> ${rawResultPath}`);

  const data = result.data as Record<string, unknown>;
  const loraUrl = extractLoraUrl(data);
  if (!loraUrl) {
    throw new Error(
      `Training completed but no LoRA weights URL was found in the response. Inspect ${rawResultPath} for the actual field name.`,
    );
  }

  const version: StyleModelVersion = {
    version: `v1-${new Date().toISOString().slice(0, 10)}`,
    loraUrl,
    triggerWord,
    plan,
    curatedCount: curatedFiles.length,
    trainingCostUsd: 0, // fal.ai doesn't return real-time billing in the response; see the account dashboard for the actual charge.
    trainedAt: new Date().toISOString(),
  };

  const versionPath = path.join(outDir, "style-model-version.json");
  fs.writeFileSync(versionPath, JSON.stringify(version, null, 2));
  console.log(`Style model version saved -> ${versionPath}`);

  return version;
}

/** fal.ai training endpoints have varied their exact output field name across versions — search defensively instead of trusting one hardcoded path. */
function extractLoraUrl(data: Record<string, unknown>): string | undefined {
  const direct = (data as { diffusers_lora_file?: { url?: string } }).diffusers_lora_file?.url;
  if (direct) return direct;

  const stack: unknown[] = [data];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (typeof value === "string" && /lora.*\.(safetensors|bin)$/i.test(value)) return value;
      if (key.toLowerCase().includes("lora") && typeof value === "object") stack.push(value);
      else if (typeof value === "object") stack.push(value);
    }
  }
  return undefined;
}
