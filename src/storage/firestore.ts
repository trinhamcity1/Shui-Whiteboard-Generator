import crypto from "node:crypto";
import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue, type Firestore } from "firebase-admin/firestore";
import type { JobCost } from "../cost/index";
import type { SceneDocumentRequest } from "../pipeline/resolveSceneDocument";

export type JobStatus = "queued" | "rendering" | "ready" | "failed";

export interface JobRecord {
  id: string;
  apiKeyId: string;
  status: JobStatus;
  statusMessage?: string;
  title?: string;
  resultUrl?: string;
  cost?: JobCost;
  request: SceneDocumentRequest;
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
