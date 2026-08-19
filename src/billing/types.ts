import type { TierId } from "./tiers";

/**
 * "Your account" in the minimal self-serve model is "whichever API keys
 * share your signup email" (ownerLabel) — see ApiKeyRecord's own comment.
 * AccountRecord is the same ownerLabel-keyed identity, extended with the
 * one thing keys alone don't carry: a subscription tier and a credit
 * balance. One record per ownerLabel, not per key.
 */
export interface AccountRecord {
  ownerLabel: string; // primary key
  tier: TierId;
  creditBalance: number; // in credits, not USD — see tiers.ts's own comment on why
  createdAt: number;
  updatedAt: number;
}

export type LedgerEntryType = "credit" | "debit";

export interface LedgerEntry {
  id: string;
  ownerLabel: string;
  type: LedgerEntryType;
  amount: number; // always positive; type says which direction
  reason: string; // e.g. "video:job-abc123", "echo-train:model-xyz", "topup", "subscription-renewal:obsidian"
  balanceAfter: number;
  createdAt: number;
}

export class InsufficientCreditsError extends Error {
  constructor(
    public readonly ownerLabel: string,
    public readonly required: number,
    public readonly available: number,
  ) {
    super(`Insufficient credits: need ${required.toFixed(2)}, have ${available.toFixed(2)}.`);
    this.name = "InsufficientCreditsError";
  }
}
