# Phase 2 — The API: deployed, async, Golpo-shaped

Read `prompts/shui-wg/shui-wg-README.md` first. Phase 1 must be done: the render pipeline works
locally end to end with real cost telemetry.

## Goal

Wrap Phase 1's pipeline in a real, deployed, authenticated REST API — the thing Shui's
main app will actually call. By the end of this phase, a request from *outside* this
project (curl, or a script in a different repo) can submit a render job over HTTPS,
poll it, and download a real finished video, with a real API key and real cost logged
to Firestore per job.

## 1. API surface — mirrored from Golpo's own v2 API on purpose

```
POST   /v1/videos/generate      Submit a job. Body: SceneDocument fields, or { narrationScript, voice, styleVariant, ... } for the script-only path.
GET    /v1/videos               List jobs for the caller's API key. ?limit=&offset=
GET    /v1/videos/{id}          Job status + result URL + cost breakdown once ready
PATCH  /v1/videos/{id}          Update { title } only
DELETE /v1/videos/{id}          Soft delete
```

Request body for `generate` — either `scenes` (a full pre-authored `SceneDocument`) or
`narrationScript` + `voice` + `styleVariant` (the script-only path, calling Phase 1's
`planScenesFromScript`). Reject a body with neither, and a body with both (ambiguous —
make the caller choose).

Response to `generate`: `{ job_id, status: "queued" }`, immediately — the render
happens asynchronously (§3). This is the same shape as Golpo's own `job_id` +
poll-for-status model, adopted deliberately rather than reinvented.

## 2. Auth

`x-api-key` header, required on every route. Keys live in the WG Firestore project
(`apiKeys/{keyId}`: `{ ownerLabel, hashedKey, createdAt, isActive }` — store a hash, not
the raw key, same discipline as any credential). Exactly one key exists after this
phase: Shui's own backend's. Issuing a second key later is a Firestore write, not a
code change — that's the whole point of building this now instead of hardcoding a
single shared secret check.

Missing or invalid key → `401`, body `{ "detail": "Missing or invalid x-api-key header." }`
— same error shape Golpo uses.

## 3. Async job execution

Use **Cloud Tasks** (GCP-native, no separate Redis/queue service to run) — `generate`
creates the job's Firestore record with `status: "queued"`, enqueues a Cloud Task
pointing at an internal `/internal/render` endpoint (not part of the public API, only
reachable by Cloud Tasks' own service account), and returns immediately. The task
handler runs Phase 1's pipeline, updates the job record through `rendering` →
`ready`/`failed`, and writes the `JobCost` record alongside it.

```ts
type JobStatus = "queued" | "rendering" | "ready" | "failed";

interface Job {
  id: string;
  apiKeyId: string;
  status: JobStatus;
  statusMessage?: string;
  resultUrl?: string;
  cost?: JobCost;              // from Phase 1
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## 4. Error responses and status codes

Match Golpo's own vocabulary — it's a good, standard shape and the explicit ask was to
follow it:

| Code | Meaning | When |
|---|---|---|
| 400 | Bad request | Malformed JSON, unknown fields |
| 401 | Missing/invalid API key | |
| 403 | Not permitted | e.g. accessing another key's job |
| 404 | Job not found | |
| 413 | Payload too large | e.g. an absurdly long `narrationScript` |
| 422 | Validation failure | Zod schema rejection — return the `{ loc, msg }` array shape Golpo uses |
| 429 | Rate limited | See §5 |
| 500 | Unexpected error | |

Every error body: `{ "detail": "..." }` or `{ "detail": [{ "loc": [...], "msg": "..." }] }`.

## 5. Rate limiting — real middleware, generous limits

Implement actual rate-limiting middleware (a simple token-bucket per API key, backed by
Firestore or in-memory since there's one caller today) rather than skipping it because
there's only one trusted key. Set the limit generously high for now. The requirement
isn't that it constrains anyone today — it's that turning it into something meaningful
for a future public tier in Phase 4 is a config change, not new code.

## 6. Deploy to Cloud Run

Build the Phase 0 Docker image (now running the full API, not just the local script),
push to Artifact Registry, deploy to Cloud Run in `shui-wg-prod`. Wire every secret
(TTS key, R2 credentials, Firestore access) through GCP Secret Manager — same pattern
Shui's own `functions/` package already uses, applied here. Confirm Cloud Run's request
timeout and memory settings comfortably cover a real render (start generous — e.g. 15
minute timeout, 4GB memory — and tune down once real render times are known).

## 7. Verify

1. From a machine that is **not** this repo — a plain `curl` or a script in a scratch
   directory — with a real API key: `POST /v1/videos/generate` with a real script,
   `GET /v1/videos/{id}` until `status: "ready"`, download the `resultUrl`, and it plays
   correctly.
2. An invalid API key gets a clean `401`, not a stack trace.
3. A malformed request body gets a `422` with a specific, actionable message.
4. The job's `cost` field, once `ready`, matches what Phase 1's local runs produced for
   similar content.
5. Deploy logs and Cloud Run metrics show no secret ever appearing in plaintext logs.
6. Load a handful of jobs concurrently (5-10) and confirm they queue and complete
   correctly rather than stepping on each other.

## Out of scope

No public signup, no billing, no docs site, no additional styles (Phase 3), no
Shui-side integration yet (Phase 7, in the main repo, once this is deployed and
trustworthy).
