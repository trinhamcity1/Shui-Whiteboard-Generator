import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue, type Firestore } from "firebase-admin/firestore";
import type { JobCost } from "../cost/index";
import type { SceneDocumentRequest } from "../pipeline/resolveSceneDocument";
import type { AdRequest } from "../schema/ad";
import { appendLocalApiKey, getLocalApiKey, listLocalApiKeysForOwner, setLocalApiKeyActive } from "./localApiKeys";
import { upsertLocalJob, getLocalJob, listLocalJobsForKey } from "./localJobs";
import { upsertLocalEchoModel, getLocalEchoModel, listLocalEchoModelsForOwner } from "./localEchoModels";
import type { EchoModelRecord } from "../images/styleModel/echoTypes";
import { upsertLocalAccount, getLocalAccount } from "./localAccounts";
import { appendLocalLedgerEntry, listLocalLedgerForOwner } from "./localLedger";
import type { AccountRecord, LedgerEntry } from "../billing/types";
import { InsufficientCreditsError } from "../billing/types";
import type { TierId } from "../billing/tiers";

export type JobStatus = "queued" | "rendering" | "ready" | "failed";

export interface JobRecord {
  id: string;
  apiKeyId: string;
  status: JobStatus;
  statusMessage?: string;
  title?: string;
  resultUrl?: string;
  cost?: JobCost;
  request: SceneDocumentRequest | AdRequest;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface ApiKeyRecord {
  id: string; // sha256 hash of the raw key — the doc ID itself, so lookup is O(1)
  ownerLabel: string; // the signup email, for self-serve accounts — the account identity is "whichever keys share this ownerLabel"
  // Last 4 characters of the raw key ("...a1b2") — the raw key itself is
  // never stored anywhere retrievable, so the dashboard needs *something*
  // to tell keys apart by. Never enough characters to be useful for
  // brute-forcing the real key.
  keyPreview: string;
  createdAt: number;
  isActive: boolean;
}

let cachedDb: Firestore | undefined;

// Set once a real Firestore call has failed for lack of credentials
// (ADC not configured — the normal case for local/sandbox dev without GCP
// access). Every asset-library/image-cache lookup already falls back to a
// local registry on failure, and that per-call try/catch does correctly
// catch the rejected promise every time — but google-auth-library's
// underlying metadata-server credential probe can *also* schedule a
// separate, disconnected retry that rejects later as an unhandled
// rejection unrelated to any promise we awaited, which crashes the
// process regardless of our try/catch. Short-circuiting to the local
// fallback immediately once we know Firestore is unreachable — instead of
// re-attempting a real network call on every single asset lookup in a
// scene — collapses many chances at that race down to one.
// Even a single real attempt can hit that race (it doesn't require repeat
// attempts to trigger), so the strongest fix is avoiding the attempt
// entirely when we can already tell ADC has nothing to find: no explicit
// service account, no well-known gcloud ADC file, and no GCP compute
// environment (Cloud Run/GCE/Cloud Functions/App Engine all serve ADC via
// a real metadata server instead of that file).
function detectAdcAvailable(): boolean {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return true;
  if (process.env.K_SERVICE || process.env.GAE_APPLICATION || process.env.FUNCTION_TARGET || process.env.GCE_METADATA_HOST) {
    return true;
  }
  const wellKnownPath = path.join(os.homedir(), ".config", "gcloud", "application_default_credentials.json");
  return fs.existsSync(wellKnownPath);
}

let firestoreKnownUnreachable = !detectAdcAvailable();

export function isFirestoreKnownUnreachable(): boolean {
  return firestoreKnownUnreachable;
}

export function markFirestoreUnreachable(): void {
  firestoreKnownUnreachable = true;
}

function getDb(): Firestore {
  if (cachedDb) return cachedDb;

  if (getApps().length === 0) {
    const projectId = process.env.FIRESTORE_PROJECT_ID;
    if (!projectId) {
      throw new Error("FIRESTORE_PROJECT_ID is not set. Add it to .env.");
    }

    // Prefer a service account file path if explicitly given (deploy time,
    // via Secret Manager); otherwise fall back to Application Default
    // Credentials — the `gcloud auth application-default login` flow, so no
    // service account key needs to sit on disk for local dev.
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    initializeApp({
      credential: serviceAccountPath ? cert(serviceAccountPath) : applicationDefault(),
      projectId,
    });
  }

  cachedDb = getFirestore();
  // Job record patches (e.g. statusMessage) legitimately omit fields via
  // `undefined` rather than always passing null — without this, the admin
  // SDK throws on any undefined property instead of just skipping it.
  cachedDb.settings({ ignoreUndefinedProperties: true });
  return cachedDb;
}

export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export async function getApiKeyByRawKey(rawKey: string): Promise<ApiKeyRecord | null> {
  const hashedKey = hashApiKey(rawKey);
  if (isFirestoreKnownUnreachable()) return getLocalApiKey(hashedKey);
  try {
    const db = getDb();
    const doc = await db.collection("apiKeys").doc(hashedKey).get();
    if (!doc.exists) return null;
    const data = doc.data()!;
    return {
      id: doc.id,
      ownerLabel: data.ownerLabel,
      keyPreview: data.keyPreview,
      createdAt: data.createdAt,
      isActive: data.isActive !== false,
    };
  } catch {
    markFirestoreUnreachable();
    return getLocalApiKey(hashedKey);
  }
}

export async function getApiKeyById(id: string): Promise<ApiKeyRecord | null> {
  if (isFirestoreKnownUnreachable()) return getLocalApiKey(id);
  try {
    const db = getDb();
    const doc = await db.collection("apiKeys").doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data()!;
    return { id: doc.id, ownerLabel: data.ownerLabel, keyPreview: data.keyPreview, createdAt: data.createdAt, isActive: data.isActive !== false };
  } catch {
    markFirestoreUnreachable();
    return getLocalApiKey(id);
  }
}

/** Every key sharing this ownerLabel (the signup email) — this IS "your account" in the minimal self-serve model, there's no separate account/user table. */
export async function listApiKeysForOwner(ownerLabel: string): Promise<ApiKeyRecord[]> {
  if (isFirestoreKnownUnreachable()) return listLocalApiKeysForOwner(ownerLabel);
  try {
    const db = getDb();
    const snapshot = await db.collection("apiKeys").where("ownerLabel", "==", ownerLabel).get();
    return snapshot.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ownerLabel: data.ownerLabel, keyPreview: data.keyPreview, createdAt: data.createdAt, isActive: data.isActive !== false };
    });
  } catch {
    markFirestoreUnreachable();
    return listLocalApiKeysForOwner(ownerLabel);
  }
}

/** Soft-revoke — never hard-deleted, since past jobs still reference this key's id and should keep resolving for history/billing purposes. */
export async function setApiKeyActive(id: string, isActive: boolean): Promise<void> {
  if (isFirestoreKnownUnreachable()) {
    setLocalApiKeyActive(id, isActive);
    return;
  }
  try {
    const db = getDb();
    await db.collection("apiKeys").doc(id).set({ isActive }, { merge: true });
  } catch {
    markFirestoreUnreachable();
    setLocalApiKeyActive(id, isActive);
  }
}

export async function createApiKey(rawKey: string, ownerLabel: string): Promise<ApiKeyRecord> {
  const hashedKey = hashApiKey(rawKey);
  const record: ApiKeyRecord = {
    id: hashedKey,
    ownerLabel,
    keyPreview: rawKey.slice(-4),
    createdAt: Date.now(),
    isActive: true,
  };

  if (isFirestoreKnownUnreachable()) {
    appendLocalApiKey(record);
    return record;
  }
  try {
    const db = getDb();
    await db.collection("apiKeys").doc(hashedKey).set({
      ownerLabel: record.ownerLabel,
      keyPreview: record.keyPreview,
      createdAt: record.createdAt,
      isActive: record.isActive,
    });
    return record;
  } catch {
    markFirestoreUnreachable();
    appendLocalApiKey(record);
    return record;
  }
}

export async function createJob(job: Omit<JobRecord, "createdAt" | "updatedAt">): Promise<JobRecord> {
  const now = Date.now();
  // deletedAt is written explicitly as null (not omitted) so the
  // `where("deletedAt", "==", null)` query in listJobsForKey matches it —
  // Firestore only matches `== null` against a field that's actually
  // present, not one that's simply absent from the document.
  const record: JobRecord = { ...job, deletedAt: job.deletedAt ?? null, createdAt: now, updatedAt: now };

  if (isFirestoreKnownUnreachable()) {
    upsertLocalJob(record);
    return record;
  }
  try {
    const db = getDb();
    await db.collection("jobs").doc(job.id).set(record);
    return record;
  } catch {
    markFirestoreUnreachable();
    upsertLocalJob(record);
    return record;
  }
}

export async function updateJob(id: string, patch: Partial<Omit<JobRecord, "id" | "createdAt">>): Promise<void> {
  const updated = { ...patch, updatedAt: Date.now() };
  if (isFirestoreKnownUnreachable()) {
    const existing = getLocalJob(id);
    if (existing) upsertLocalJob({ ...existing, ...updated });
    return;
  }
  try {
    const db = getDb();
    await db.collection("jobs").doc(id).set(updated, { merge: true });
  } catch {
    markFirestoreUnreachable();
    const existing = getLocalJob(id);
    if (existing) upsertLocalJob({ ...existing, ...updated });
  }
}

export async function getJob(id: string): Promise<JobRecord | null> {
  if (isFirestoreKnownUnreachable()) return getLocalJob(id);
  try {
    const db = getDb();
    const doc = await db.collection("jobs").doc(id).get();
    if (!doc.exists) return null;
    return doc.data() as JobRecord;
  } catch {
    markFirestoreUnreachable();
    return getLocalJob(id);
  }
}

export async function listJobsForKey(apiKeyId: string, limit: number, offset: number): Promise<JobRecord[]> {
  if (isFirestoreKnownUnreachable()) return listLocalJobsForKey(apiKeyId, limit, offset);
  try {
    const db = getDb();
    const snapshot = await db
      .collection("jobs")
      .where("apiKeyId", "==", apiKeyId)
      .where("deletedAt", "==", null)
      .orderBy("createdAt", "desc")
      .offset(offset)
      .limit(limit)
      .get();
    return snapshot.docs.map((d) => d.data() as JobRecord);
  } catch {
    markFirestoreUnreachable();
    return listLocalJobsForKey(apiKeyId, limit, offset);
  }
}

export interface ImageCacheRecord {
  provider: string;
  styleVariant: string;
  concept: string;
  r2Key: string;
  widthPx: number;
  heightPx: number;
  costUsd: number; // cost of the original generation, not the cache hit
  createdAt: number;
  hitCount: number;
}

export async function getImageCacheEntry(cacheKey: string): Promise<ImageCacheRecord | null> {
  const db = getDb();
  const doc = await db.collection("imageCache").doc(cacheKey).get();
  if (!doc.exists) return null;
  return doc.data() as ImageCacheRecord;
}

export async function createImageCacheEntry(cacheKey: string, record: ImageCacheRecord): Promise<void> {
  const db = getDb();
  await db.collection("imageCache").doc(cacheKey).set(record);
}

export async function incrementImageCacheHit(cacheKey: string): Promise<void> {
  const db = getDb();
  await db.collection("imageCache").doc(cacheKey).update({ hitCount: FieldValue.increment(1) });
}

export interface LibraryAssetRecord {
  id: string;
  tier: string;
  role: string;
  provider: string;
  r2Key: string;
  imageUrl: string;
  widthPx: number;
  heightPx: number;
  costUsd: number;
  generatedAt: string;
  description: string;
  origin: "v1-manifest" | "auto-expanded";
  quarantineStatus: "pending" | "promoted";
  labelAnchor?: { xFraction: number; yFraction: number };
  anchors?: Array<{ xFraction: number; yFraction: number; kind: "label" | "inset" | "attachment" }>;
  dominantColor?: string;
}

export async function getLibraryAsset(id: string): Promise<LibraryAssetRecord | null> {
  const db = getDb();
  const doc = await db.collection("assetLibrary").doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as LibraryAssetRecord;
}

export async function createLibraryAsset(record: LibraryAssetRecord): Promise<void> {
  const db = getDb();
  await db.collection("assetLibrary").doc(record.id).set(record);
}

/** Drops a library asset's record entirely — used when it fails quarantine and isn't going to be retried. */
export async function deleteLibraryAsset(id: string): Promise<void> {
  const db = getDb();
  await db.collection("assetLibrary").doc(id).delete();
}

// A business's own uploaded photo, for the Ads product. Ownership-scoped
// to apiKeyId — the same boundary every job already uses — rather than a
// new user/profile concept: an api key already IS the account today, and
// this slots under a real login system later without changing shape (a
// logged-in session just resolves to the same apiKeyId it does now).
export interface AdAssetRecord {
  id: string;
  apiKeyId: string;
  r2Key: string;
  url: string;
  label?: string;
  contentType: string;
  createdAt: number;
}

export async function createAdAsset(record: AdAssetRecord): Promise<void> {
  const db = getDb();
  await db.collection("adAssets").doc(record.id).set(record);
}

export async function getAdAsset(id: string): Promise<AdAssetRecord | null> {
  const db = getDb();
  const doc = await db.collection("adAssets").doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as AdAssetRecord;
}

export async function listAdAssetsForKey(apiKeyId: string): Promise<AdAssetRecord[]> {
  const db = getDb();
  const snapshot = await db.collection("adAssets").where("apiKeyId", "==", apiKeyId).get();
  return snapshot.docs.map((d) => d.data() as AdAssetRecord);
}

export async function deleteAdAsset(id: string): Promise<void> {
  const db = getDb();
  await db.collection("adAssets").doc(id).delete();
}

export async function listLibraryAssets(tier?: string): Promise<LibraryAssetRecord[]> {
  const db = getDb();
  let query: FirebaseFirestore.Query = db.collection("assetLibrary");
  if (tier) query = query.where("tier", "==", tier);
  const snapshot = await query.get();
  return snapshot.docs.map((d) => d.data() as LibraryAssetRecord);
}

/** One reusable Recraft style_id per named character, so every pose of that character shares a consistent look. */
export async function getRecraftStyleId(characterKey: string): Promise<string | null> {
  const db = getDb();
  const doc = await db.collection("recraftStyles").doc(characterKey).get();
  if (!doc.exists) return null;
  return (doc.data() as { styleId: string }).styleId;
}

export async function saveRecraftStyleId(characterKey: string, styleId: string): Promise<void> {
  const db = getDb();
  await db.collection("recraftStyles").doc(characterKey).set({ styleId, createdAt: Date.now() });
}

export async function createEchoModel(record: EchoModelRecord): Promise<void> {
  if (isFirestoreKnownUnreachable()) {
    upsertLocalEchoModel(record);
    return;
  }
  try {
    const db = getDb();
    await db.collection("echoModels").doc(record.id).set(record);
  } catch {
    markFirestoreUnreachable();
    upsertLocalEchoModel(record);
  }
}

export async function getEchoModel(id: string): Promise<EchoModelRecord | null> {
  if (isFirestoreKnownUnreachable()) return getLocalEchoModel(id);
  try {
    const db = getDb();
    const doc = await db.collection("echoModels").doc(id).get();
    if (!doc.exists) return null;
    return doc.data() as EchoModelRecord;
  } catch {
    markFirestoreUnreachable();
    return getLocalEchoModel(id);
  }
}

export async function listEchoModelsForOwner(ownerLabel: string): Promise<EchoModelRecord[]> {
  if (isFirestoreKnownUnreachable()) return listLocalEchoModelsForOwner(ownerLabel);
  try {
    const db = getDb();
    const snapshot = await db.collection("echoModels").where("ownerLabel", "==", ownerLabel).get();
    return snapshot.docs.map((d) => d.data() as EchoModelRecord);
  } catch {
    markFirestoreUnreachable();
    return listLocalEchoModelsForOwner(ownerLabel);
  }
}

export async function updateEchoModel(id: string, patch: Partial<Omit<EchoModelRecord, "id" | "createdAt">>): Promise<void> {
  const updated = { ...patch, updatedAt: Date.now() };
  if (isFirestoreKnownUnreachable()) {
    const existing = getLocalEchoModel(id);
    if (!existing) return;
    upsertLocalEchoModel({ ...existing, ...updated });
    return;
  }
  try {
    const db = getDb();
    await db.collection("echoModels").doc(id).set(updated, { merge: true });
  } catch {
    markFirestoreUnreachable();
    const existing = getLocalEchoModel(id);
    if (existing) upsertLocalEchoModel({ ...existing, ...updated });
  }
}

const DEFAULT_TIER: TierId = "siltstone";

/** Creates the account on first touch (defaults: siltstone tier, 0 balance) — there's no separate signup step for the wallet, it just starts existing the first time anything asks about it. */
export async function getOrCreateAccount(ownerLabel: string): Promise<AccountRecord> {
  if (isFirestoreKnownUnreachable()) {
    const existing = getLocalAccount(ownerLabel);
    if (existing) return existing;
    const fresh: AccountRecord = { ownerLabel, tier: DEFAULT_TIER, creditBalance: 0, createdAt: Date.now(), updatedAt: Date.now() };
    upsertLocalAccount(fresh);
    return fresh;
  }
  try {
    const db = getDb();
    const doc = await db.collection("accounts").doc(ownerLabel).get();
    if (doc.exists) return doc.data() as AccountRecord;
    const fresh: AccountRecord = { ownerLabel, tier: DEFAULT_TIER, creditBalance: 0, createdAt: Date.now(), updatedAt: Date.now() };
    await db.collection("accounts").doc(ownerLabel).set(fresh);
    return fresh;
  } catch {
    markFirestoreUnreachable();
    const existing = getLocalAccount(ownerLabel);
    if (existing) return existing;
    const fresh: AccountRecord = { ownerLabel, tier: DEFAULT_TIER, creditBalance: 0, createdAt: Date.now(), updatedAt: Date.now() };
    upsertLocalAccount(fresh);
    return fresh;
  }
}

export async function setAccountTier(ownerLabel: string, tier: TierId): Promise<AccountRecord> {
  const account = await getOrCreateAccount(ownerLabel);
  const updated: AccountRecord = { ...account, tier, updatedAt: Date.now() };
  if (isFirestoreKnownUnreachable()) {
    upsertLocalAccount(updated);
    return updated;
  }
  try {
    const db = getDb();
    await db.collection("accounts").doc(ownerLabel).set(updated, { merge: true });
    return updated;
  } catch {
    markFirestoreUnreachable();
    upsertLocalAccount(updated);
    return updated;
  }
}

async function appendLedgerEntry(entry: LedgerEntry): Promise<void> {
  if (isFirestoreKnownUnreachable()) {
    appendLocalLedgerEntry(entry);
    return;
  }
  try {
    const db = getDb();
    await db.collection("ledger").doc(entry.id).set(entry);
  } catch {
    markFirestoreUnreachable();
    appendLocalLedgerEntry(entry);
  }
}

/** Adds credits (a purchase, a subscription renewal, a manual top-up) and records the ledger entry. Never fails on balance — crediting is always allowed. */
export async function creditAccount(ownerLabel: string, amount: number, reason: string): Promise<AccountRecord> {
  if (amount <= 0) throw new Error(`creditAccount amount must be positive, got ${amount}.`);
  const account = await getOrCreateAccount(ownerLabel);
  const updated: AccountRecord = { ...account, creditBalance: account.creditBalance + amount, updatedAt: Date.now() };

  if (isFirestoreKnownUnreachable()) {
    upsertLocalAccount(updated);
  } else {
    try {
      const db = getDb();
      await db.collection("accounts").doc(ownerLabel).set(updated, { merge: true });
    } catch {
      markFirestoreUnreachable();
      upsertLocalAccount(updated);
    }
  }

  await appendLedgerEntry({
    id: crypto.randomUUID(),
    ownerLabel,
    type: "credit",
    amount,
    reason,
    balanceAfter: updated.creditBalance,
    createdAt: Date.now(),
  });
  return updated;
}

/**
 * Deducts credits for real, delivered value (a rendered video's real
 * minutes, a completed Echo training run) — never a pre-authorization,
 * since neither of those costs is knowable until after the work is done.
 * Throws InsufficientCreditsError instead of letting a balance go
 * negative; callers that already started the real-money work before
 * calling this (which every current caller does, deliberately — see
 * echoTrainHandler.ts and renderHandler.ts's own comments) accept that as
 * a known gap until a pre-check against the *estimated* cost is added.
 * Uses a Firestore transaction against the real DB so two concurrent
 * debits on the same account can't both read a stale balance; the local
 * fallback is a plain read-modify-write, correct only for the
 * single-process dev/sandbox environment it's meant for.
 */
export async function debitAccount(ownerLabel: string, amount: number, reason: string): Promise<AccountRecord> {
  if (amount <= 0) throw new Error(`debitAccount amount must be positive, got ${amount}.`);

  if (isFirestoreKnownUnreachable()) {
    const account = await getOrCreateAccount(ownerLabel);
    if (account.creditBalance < amount) {
      throw new InsufficientCreditsError(ownerLabel, amount, account.creditBalance);
    }
    const updated: AccountRecord = { ...account, creditBalance: account.creditBalance - amount, updatedAt: Date.now() };
    upsertLocalAccount(updated);
    await appendLedgerEntry({
      id: crypto.randomUUID(),
      ownerLabel,
      type: "debit",
      amount,
      reason,
      balanceAfter: updated.creditBalance,
      createdAt: Date.now(),
    });
    return updated;
  }

  try {
    const db = getDb();
    const ref = db.collection("accounts").doc(ownerLabel);
    const updated = await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const account: AccountRecord = doc.exists
        ? (doc.data() as AccountRecord)
        : { ownerLabel, tier: DEFAULT_TIER, creditBalance: 0, createdAt: Date.now(), updatedAt: Date.now() };
      if (account.creditBalance < amount) {
        throw new InsufficientCreditsError(ownerLabel, amount, account.creditBalance);
      }
      const next: AccountRecord = { ...account, creditBalance: account.creditBalance - amount, updatedAt: Date.now() };
      tx.set(ref, next, { merge: true });
      return next;
    });
    await appendLedgerEntry({
      id: crypto.randomUUID(),
      ownerLabel,
      type: "debit",
      amount,
      reason,
      balanceAfter: updated.creditBalance,
      createdAt: Date.now(),
    });
    return updated;
  } catch (err) {
    if (err instanceof InsufficientCreditsError) throw err;
    markFirestoreUnreachable();
    return debitAccount(ownerLabel, amount, reason); // retries once through the now-local path
  }
}

export async function listLedgerForOwner(ownerLabel: string): Promise<LedgerEntry[]> {
  if (isFirestoreKnownUnreachable()) return listLocalLedgerForOwner(ownerLabel);
  try {
    const db = getDb();
    const snapshot = await db.collection("ledger").where("ownerLabel", "==", ownerLabel).orderBy("createdAt", "desc").get();
    return snapshot.docs.map((d) => d.data() as LedgerEntry);
  } catch {
    markFirestoreUnreachable();
    return listLocalLedgerForOwner(ownerLabel);
  }
}

export { Timestamp };
