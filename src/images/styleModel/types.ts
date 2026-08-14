/** A single generated candidate awaiting human curation (Plan A §3 step 1-2). */
export interface StyleCandidate {
  id: string; // e.g. "candidate-0001"
  prompt: string;
  subject: string; // short label for what the candidate depicts, e.g. "narrator, explaining pose"
  localPath: string;
  costUsd: number;
  generatedAt: string;
}

/** Written once training completes — the one artifact every future asset-library generation reads. */
export interface StyleModelVersion {
  version: string; // e.g. "v1-2026-08-14"
  loraUrl: string;
  triggerWord: string;
  plan: "a" | "b";
  curatedCount: number;
  trainingCostUsd: number;
  trainedAt: string;
}

/** One sign-off-gate test asset generated through the freshly trained model. */
export interface StyleModelTestAsset {
  id: string;
  prompt: string;
  localPath: string;
  costUsd: number;
  styleModelVersion: string;
}
