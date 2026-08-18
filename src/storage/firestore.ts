import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue, type Firestore } from "firebase-admin/firestore";
import type { JobCost } from "../cost/index";
import type { SceneDocumentRequest } from "../pipeline/resolveSceneDocument";
import type { AdRequest } from "../schema/ad";

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
  ownerLabel: string;
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
  const db = getDb();
  const hashedKey = hashApiKey(rawKey);
  const doc = await db.collection("apiKeys").doc(hashedKey).get();
  if (!doc.exists) return null;
  const data = doc.data()!;
  return {
    id: doc.id,
    ownerLabel: data.ownerLabel,
    createdAt: data.createdAt,
    isActive: data.isActive !== false,
  };
}

export async function createApiKey(rawKey: string, ownerLabel: string): Promise<void> {
  const db = getDb();
  const hashedKey = hashApiKey(rawKey);
  await db.collection("apiKeys").doc(hashedKey).set({
    ownerLabel,
    createdAt: Date.now(),
    isActive: true,
  });
}

export async function createJob(job: Omit<JobRecord, "createdAt" | "updatedAt">): Promise<JobRecord> {
  const db = getDb();
  const now = Date.now();
  // deletedAt is written explicitly as null (not omitted) so the
  // `where("deletedAt", "==", null)` query in listJobsForKey matches it —
  // Firestore only matches `== null` against a field that's actually
  // present, not one that's simply absent from the document.
  const record: JobRecord = { ...job, deletedAt: job.deletedAt ?? null, createdAt: now, updatedAt: now };
  await db.collection("jobs").doc(job.id).set(record);
  return record;
}

export async function updateJob(id: string, patch: Partial<Omit<JobRecord, "id" | "createdAt">>): Promise<void> {
  const db = getDb();
  await db.collection("jobs").doc(id).set({ ...patch, updatedAt: Date.now() }, { merge: true });
}

export async function getJob(id: string): Promise<JobRecord | null> {
  const db = getDb();
  const doc = await db.collection("jobs").doc(id).get();
  if (!doc.exists) return null;
  return doc.data() as JobRecord;
}

export async function listJobsForKey(apiKeyId: string, limit: number, offset: number): Promise<JobRecord[]> {
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

export { Timestamp };
