import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { generateEchoCandidates } from "./echoCandidates";
import { selectBestEchoCandidates } from "./echoSelection";
import { trainStyleModel } from "./train";
import type { StyleModelVersion } from "./types";

export interface EchoPipelineResult {
  candidateUrls: string[];
  selectedUrls: string[];
  styleModel: StyleModelVersion;
  costUsd: number;
}

async function downloadToDir(urls: string[], dir: string): Promise<void> {
  fs.mkdirSync(dir, { recursive: true });
  await Promise.all(
    urls.map(async (url, i) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to download training image (${response.status}): ${url}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(path.join(dir, `img-${String(i).padStart(3, "0")}.png`), buffer);
    }),
  );
}

/**
 * The full Echo model (re)training flow: expand the customer's 5-10
 * reference uploads into a larger candidate pool, auto-select the
 * strongest subset, then train a dedicated LoRA on it. Orchestrates the
 * three real-money steps (candidate generation, selection, training) in
 * one place so echo.ts's route handler and the async job worker both call
 * exactly this, never re-implement the sequence.
 */
export async function runEchoTrainingPipeline(args: {
  echoModelId: string;
  referenceImageUrls: string[];
  falApiKey: string;
  anthropicApiKey?: string;
  onStatusChange?: (status: "generating_candidates" | "selecting" | "training") => Promise<void>;
}): Promise<EchoPipelineResult> {
  await args.onStatusChange?.("generating_candidates");
  const candidates = await generateEchoCandidates({
    referenceImageUrls: args.referenceImageUrls,
    falApiKey: args.falApiKey,
  });

  await args.onStatusChange?.("selecting");
  const selection = await selectBestEchoCandidates({
    candidateUrls: candidates.candidateUrls,
    apiKey: args.anthropicApiKey,
  });

  await args.onStatusChange?.("training");
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "echo-training-"));
  const curatedDir = path.join(tmpRoot, "curated");
  try {
    await downloadToDir(selection.selectedUrls, curatedDir);

    // A per-model trigger word, not the product's shared "shwgstyle" — see
    // trainStyleModel's own comment on why this matters even though the
    // generation call always pairs a triggerWord with its own loraUrl.
    const triggerWord = `echo${args.echoModelId.replace(/-/g, "").slice(0, 12)}`;

    const styleModel = await trainStyleModel({
      apiKey: args.falApiKey,
      curatedDir,
      outDir: tmpRoot,
      plan: "echo",
      triggerWord,
    });

    return {
      candidateUrls: candidates.candidateUrls,
      selectedUrls: selection.selectedUrls,
      styleModel,
      costUsd: candidates.costUsd + selection.costUsd + 2.0, // fal.ai's flat $2/training-run rate (train.ts's trainingCostUsd isn't populated from a real response)
    };
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

/** Cheap uniqueness helper for callers that need a fresh id before the record exists yet. */
export function generateEchoModelId(): string {
  return crypto.randomUUID();
}
