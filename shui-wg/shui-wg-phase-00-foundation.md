# Phase 0 — Foundation: repo, GCP project, one real rendered video

Read `prompts/shui-wg/shui-wg-README.md` first — especially the domain-agnostic rule and the
GCP/Cloud Run decision. Follow those conventions for the whole phase.

## Goal

Prove the core technical bet — Remotion can render a narrated whiteboard video for
pennies — before building any API, queue, or cloud deployment around it. By the end of
this phase there is a real `.mp4` file on disk, produced by a script you ran, containing
a hardcoded whiteboard scene with real synced narration. Nothing here is deployed yet.

If this phase reveals that Remotion, or the whiteboard-component approach, doesn't
actually produce acceptable output cheaply and quickly, that needs to be known now —
before a queue, an API, and a second GCP project get built on top of a shaky
foundation.

## 1. Repo scaffold

New repository, `shui-whiteboard-generator` (or your preferred name — referred to as
Shui WG throughout these prompts). Node 20+, TypeScript, strict mode.

```
shui-wg/
  src/
    render/         Remotion compositions and scene components
    tts/             TTS provider interface + implementation(s)
    api/             (Phase 2 — empty for now)
    queue/           (Phase 2 — empty for now)
    storage/         R2 client wrapper
    cost/            Cost calculation helpers
    schema/          Zod schemas for the scene JSON and API payloads
  scripts/
    render-local.ts  The phase's own deliverable — see §4
  Dockerfile
  package.json
  tsconfig.json
```

Package manager: npm or pnpm, your call — be consistent and document the choice in a
README. Zod for all runtime validation (scene JSON, later API payloads) — one schema
library end to end, not a mix.

## 2. GCP and R2 setup

- New GCP project, `shui-wg-prod` (or similar) — separate from `shui-prod`. Enable
  billing, Secret Manager, Cloud Run, Artifact Registry (for the Docker image).
- New R2 bucket, `shui-wg-renders`, separate credentials from Shui's `shui-videos`
  bucket (a distinct R2 API token scoped to only this bucket).
- New, small Firebase project, `shui-wg` (or similar), Firestore only — no Auth, no
  Hosting. This is where job records, API keys, and cost logs will live starting
  Phase 2; nothing to build yet, just provision it now so Phase 2 isn't blocked on
  project setup.
- All credentials (R2 keys, TTS API key once chosen) go in a local `.env` for this
  phase's script, gitignored. No Secret Manager wiring yet — that's Phase 2, once
  there's a deployed service to wire it into.

## 3. Choose and integrate a TTS provider

Define a small `TTSProvider` interface now, even though only one implementation exists
today — the same "protocol first, one real implementation" pattern Shui's own
`TutorAIService`/`ModelClient` already use, for the same reason: swapping providers
later shouldn't touch call sites.

```ts
interface TTSProvider {
  synthesize(text: string, opts: { voice: string }): Promise<{
    audioBuffer: Buffer;
    durationSeconds: number;
    wordTimings?: Array<{ word: string; startSeconds: number; endSeconds: number }>;
    costUsd: number;
  }>;
}
```

Pick one real provider to implement first. Recommendation: **ElevenLabs** — narration
quality matters more here than almost anywhere else in this project, since the first
real content this feeds is a citizenship exam and the narrator is standing in for a
trustworthy human tutor. It's also the priciest TTS option and still costs cents per
video, so the quality/cost tradeoff isn't close. If real usage later shows cost
pressure, a cheaper Google/Amazon neural voice is a one-file swap behind the same
interface, not a rewrite.

Word-level timing matters: use whatever timing metadata the provider returns (ElevenLabs
and most competitors expose this) rather than estimating duration from character count.
Scene timing in Phase 1 is built on top of this — get it right here.

## 4. One hardcoded scene, rendered locally

`scripts/render-local.ts` is this phase's actual deliverable. It should:

1. Take a hardcoded narration script (a real one-minute paragraph — use one of Shui's
   actual citizenship-exam quick-facts as the test content, so the first real output
   this project ever produces is genuinely useful, not throwaway lorem ipsum).
2. Call the TTS provider, get back audio + timing.
3. Render a **minimal** Remotion composition — a title card and one bullet list is
   enough for this phase, nothing more elaborate. The point is proving the pipeline
   shape, not building the component library yet (that's Phase 1 in full).
4. Composite audio + video with FFmpeg (via `@remotion/renderer`'s built-in
   audio-muxing, or a direct `fluent-ffmpeg` step if you need more control).
5. Write the result to `./output/test-1.mp4` and print the real cost breakdown
   (TTS characters × $/char, render wall-clock time) to the console.

Run it. Watch the video. If the narration doesn't sync reasonably to the visuals, or
the render takes an alarming amount of time or looks obviously wrong, fix that here —
don't carry a known-bad pipeline shape into Phase 1's much larger build.

## 5. Dockerfile, built and run locally (not deployed yet)

Write a `Dockerfile` that installs Node, the Chromium dependencies Remotion's renderer
needs, and runs `render-local.ts` (or an equivalent) inside the container. Build it
locally (`docker build`) and run it locally (`docker run`) — confirm the exact same
render succeeds inside the container as outside it. This is the image Phase 2 deploys
to Cloud Run; proving it works in a container now, while it's trivial to debug
interactively, avoids debugging a broken container image at the same time as debugging
a new Cloud Run deployment in Phase 2.

## 6. Verify

1. `scripts/render-local.ts` produces a real, watchable `.mp4` with synced narration.
2. The printed cost breakdown is in the range this project is betting on — flag it
   loudly in the phase report if a single one-minute video's TTS + render cost estimate
   is anywhere near $1, since the entire project's premise depends on it being closer
   to $0.05–0.20.
3. The same script runs successfully inside the Docker container, producing the same
   output.
4. No secret is committed anywhere — `git grep` for the TTS API key and R2 credentials
   returns nothing outside `.env` (which is gitignored).
5. `shui-wg-prod` (GCP) and the WG Firebase project both exist and are ready for
   Phase 2, but nothing is deployed to them yet.

## Out of scope

No API, no queue, no auth, no multiple styles, no deployment. If you find yourself
building any of those in this phase, stop — the goal here is a single proof that the
core bet is real, as cheaply and quickly as possible.
