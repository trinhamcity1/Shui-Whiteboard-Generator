import type { StyleModelVersion } from "./types";

export type EchoModelStatus =
  | "pending"
  | "generating_candidates"
  | "selecting"
  | "training"
  | "ready"
  | "failed";

/**
 * Pyramidion-exclusive custom style: a customer uploads 5-10 reference
 * images of their own character/art, we generate a larger candidate pool
 * from those references, auto-select the strongest subset, and train a
 * dedicated LoRA on it (same underlying trainStyleModel() the product's own
 * default sketch style was trained with — see styleModel/train.ts).
 *
 * Deliberately NOT reusing the shared v1 asset library's quarantine/
 * promotion flow (assetLibrary/autoExpand.ts) — that flow writes into the
 * one shared registry every customer's videos pull from, which would leak
 * one customer's private style into every other customer's videos. An Echo
 * model's generations must never be cached or reused across owners; see
 * resolveImages.ts's echoModel branch.
 */
export interface EchoModelRecord {
  id: string;
  ownerLabel: string; // same "whichever API keys share this signup email" concept as ApiKeyRecord
  status: EchoModelStatus;
  referenceImageUrls: string[]; // the 5-10 raw customer uploads this (re)training run used
  candidateImageUrls?: string[]; // the larger generated pool, before selection
  selectedImageUrls?: string[]; // the ~20 chosen for training
  styleModel?: StyleModelVersion; // set once training completes successfully
  retrainCount: number; // 0 on first successful training; incremented on each retrain
  errorMessage?: string; // set when status === "failed"
  lastRunCostUsd?: number; // real cost of the most recent (re)training run (candidates + selection + training)
  createdAt: number;
  updatedAt: number;
}
