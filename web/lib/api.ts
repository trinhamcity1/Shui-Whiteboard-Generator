const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: unknown,
  ) {
    super(typeof detail === "string" ? detail : "Request failed.");
    this.name = "ApiRequestError";
  }
}

async function request<T>(
  path: string,
  opts: { method?: string; apiKey?: string; body?: unknown; formData?: FormData } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.apiKey) headers["x-api-key"] = opts.apiKey;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: opts.method ?? (opts.body || opts.formData ? "POST" : "GET"),
    headers,
    body: opts.formData ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    cache: "no-store",
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new ApiRequestError(res.status, data?.detail ?? data);
  }
  return data as T;
}

// ---- Types mirroring the API's real response shapes ----

export interface TierConfig {
  id: "siltstone" | "obsidian" | "alabaster" | "pyramidion";
  name: string;
  monthlyPriceUsd: number | null;
  monthlyCredits: number;
  baseCreditsPerMinute: number;
  topicCreditsPerMinute: number | null;
  maxLengthMinutes: number;
  apiAccess: boolean;
  uiAccess: boolean;
  verticalOnly: boolean;
  echoAccess: boolean;
}

export interface PricingResponse {
  tiers: TierConfig[];
  echo: { trainCredits: number; retrainCredits: number };
}

export interface AccountResponse extends Omit<TierConfig, "id" | "name"> {
  tier: TierConfig["id"];
  tierName: string;
  creditBalance: number;
}

export interface LedgerEntry {
  id: string;
  type: "credit" | "debit";
  amount: number;
  reason: string;
  balanceAfter: number;
  createdAt: number;
}

export interface ApiKeySummary {
  id: string;
  keyPreview: string;
  createdAt: number;
  isActive: boolean;
}

export interface JobSummary {
  id: string;
  status: "queued" | "rendering" | "ready" | "failed";
  title?: string;
  result_url?: string;
  /** True once the video is ready but the account's current plan doesn't allow downloading it (Siltstone) — see serializeJob's own comment. */
  download_locked?: boolean;
  status_message?: string;
  cost?: { totalCostUsd: number };
  created_at: number;
  updated_at: number;
}

export interface EchoModelSummary {
  id: string;
  status: "pending" | "generating_candidates" | "selecting" | "training" | "ready" | "failed";
  referenceImageCount: number;
  triggerWord?: string;
  retrainCount: number;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

// ---- Public ----

export function fetchPricing(): Promise<PricingResponse> {
  return request<PricingResponse>("/v1/pricing");
}

export function signup(email: string): Promise<{ apiKey: string; email: string; createdAt: number }> {
  return request("/v1/signup", { method: "POST", body: { email } });
}

// ---- Authenticated ----

export function fetchAccount(apiKey: string): Promise<AccountResponse> {
  return request("/v1/account", { apiKey });
}

export function fetchLedger(apiKey: string): Promise<{ items: LedgerEntry[] }> {
  return request("/v1/account/ledger", { apiKey });
}

export function cancelSubscription(apiKey: string): Promise<{ tier: TierConfig["id"]; tierName: string; creditBalance: number }> {
  return request("/v1/account/cancel", { method: "POST", apiKey });
}

export function fetchKeys(apiKey: string): Promise<{ items: ApiKeySummary[] }> {
  return request("/v1/keys", { apiKey });
}

export function createKey(apiKey: string): Promise<{ apiKey: string; createdAt: number }> {
  return request("/v1/keys", { method: "POST", apiKey });
}

export function revokeKey(apiKey: string, id: string): Promise<void> {
  return request(`/v1/keys/${id}`, { method: "DELETE", apiKey });
}

export function fetchJobs(apiKey: string): Promise<{ items: JobSummary[] }> {
  return request("/v1/videos", { apiKey });
}

export function fetchJob(apiKey: string, id: string): Promise<JobSummary> {
  return request(`/v1/videos/${id}`, { apiKey });
}

export function deleteJob(apiKey: string, id: string): Promise<void> {
  return request(`/v1/videos/${id}`, { method: "DELETE", apiKey });
}

export interface GenerateVideoRequest {
  voice: string;
  styleVariant: string;
  orientation?: "vertical" | "horizontal";
  topic?: string;
  narrationScript?: string;
  targetDurationSeconds?: number;
  echoModelId?: string;
}

export function generateVideo(apiKey: string, body: GenerateVideoRequest): Promise<{ job_id: string; status: string }> {
  return request("/v1/videos/generate", { method: "POST", apiKey, body });
}

export function fetchEchoModels(apiKey: string): Promise<{ items: EchoModelSummary[] }> {
  return request("/v1/echo/models", { apiKey });
}

export function createEchoModel(apiKey: string, files: File[]): Promise<EchoModelSummary> {
  const formData = new FormData();
  for (const file of files) formData.append("references", file);
  return request("/v1/echo/models", { method: "POST", apiKey, formData });
}

export function retrainEchoModel(apiKey: string, id: string, files: File[]): Promise<EchoModelSummary> {
  const formData = new FormData();
  for (const file of files) formData.append("references", file);
  return request(`/v1/echo/models/${id}/retrain`, { method: "POST", apiKey, formData });
}
