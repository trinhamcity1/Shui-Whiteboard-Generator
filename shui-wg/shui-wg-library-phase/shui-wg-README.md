# Shui Whiteboard Generator (Shui WG) — Build Prompts

## What this is and why it exists

Shui (the main app) currently generates its whiteboard-style lesson videos through
Golpo AI, at $2.00/minute of video via their API-only tier. That's fine at low volume
— it fully covers Shui's near-term citizenship-exam content on a single $200 top-up —
but it doesn't scale into "1-2 topics a week, all year" without a real ongoing cost
line, and Golpo's API-only tier explicitly excludes the manual dashboard, so there's no
partial-credit path either.

**Shui WG is a self-hosted whiteboard video generation pipeline**: give it a narration
script (and optionally a pre-authored visual timeline), it returns a rendered, narrated,
vertical whiteboard-style MP4 with real illustrations, not just typographic slides.
Based on real, current pricing for the underlying pieces — Remotion's own published
render-cost examples, current TTS pricing, and Remotion's free-for-small-teams
license — the narration/render/compositing layer alone (Phases 0-3) runs
**roughly $0.02–0.03 per one-minute video**, and even with real illustration generation
added on top (Phase 4), a realistic worst-case per-video cost is **$0.05–0.27**
depending on image provider and illustration density — see
`shui-wg-phase-04-illustration-engine.md` for the itemized breakdown of both providers,
and `shui-wg-phase-04-amendment-asset-library.md` for the direction that brings the
illustrated marginal cost even lower. Either number is far below Golpo's $2.00/minute
API rate. That gap is the entire reason this project exists.

**This is a separate repository from Shui**, and a deliberately different kind of
project: Shui is a consumer app; Shui WG is closer to infrastructure. It should never
know what a "topic," "quiz," or "learner" is. It takes a script, returns a video. That
constraint is what keeps it reusable — if Shui WG had Shui's data model baked into it,
it could never become anything other than a Shui-only tool.

## Scope decision, stated plainly

**Phase 0-4 build an internal-only service.** It has real API-key auth, a real
versioned REST contract, real per-job cost telemetry, and — as of Phase 4 — real
illustration generation, from day one where it matters, not because there's a second
customer today, but because retrofitting auth, billing, or a swappable image-provider
interface onto a tool that assumed a single trusted caller and text-only output is a
rewrite, and designing them in from the start is not. Concretely: today exactly one API
key exists, and it belongs to Shui's own backend. **Nothing in phases 0-4 builds a
public signup flow, billing, a docs site, or rate limiting tuned for strangers.** That's
Phase 5, and Phase 5 is explicitly a roadmap document, not a build phase to start now —
see that file for the trigger condition for when it's time.

The domain **tri-nham.com** is reserved for the eventual public product (Phase 5). No
DNS work happens before then.

## Shared conventions — every phase must follow these

**The domain-agnostic rule.** Shui WG's request/response schema must never contain a
field that only makes sense inside Shui (no `topicId`, no `questionId`, no `category`).
If a piece of information is Shui-specific, it belongs in Shui's own backend, which
calls Shui WG with a plain script and gets back a plain video. Test for this
concretely: could a second, unrelated project use this exact API tomorrow with zero
code changes on the WG side? If not, something leaked across the boundary.

**Cloud platform: GCP, single vendor, separate project.** Shui's existing backend lives
on Firebase/GCP (`shui-prod`). Shui WG gets **its own GCP project** (e.g.
`shui-wg-prod`), not a shared one — compute-heavy render jobs shouldn't compete for
quota visibility with Shui's own Firestore/Functions, and keeping billing separate is
what makes "prove this costs under $1/video" an honest, isolated measurement instead of
a number mixed in with everything else GCP charges for. Use **Cloud Run** for both the
API layer and the render workers — not AWS Lambda. Remotion's core renderer
(`@remotion/renderer`) is a plain Node + headless-Chromium process; it doesn't require
AWS. Introducing a second cloud vendor for a single feature (Remotion Lambda) buys
parallelism you don't need yet at the cost of a second IAM/billing/secrets surface to
maintain. If Cloud Run's request limits (60 minutes, up to 32GB memory / 8 vCPU on
Gen2) prove genuinely too tight once real render jobs are running, the fallback is a
Compute Engine VM or GKE running the *same Docker image* — a compute-target change, not
an architecture rewrite.

**Storage: Shui WG owns its own R2 bucket**, e.g. `shui-wg-renders`, separate from
Shui's `shui-videos` bucket. Shui WG writes finished renders there and returns a URL.
It is Shui's job (Phase 7, in the main repo) to decide whether a render is good enough
to become a real, published Shui video — copying it into `shui-videos` through Shui's
*existing* upload pipeline (`createVideoUpload`/`finalizeVideoUpload`). Shui WG never
touches Shui's Firestore, ever.

**Data store for WG's own state**: a second, small Firebase project (e.g. `shui-wg`,
Firestore only — no Auth, no Hosting yet) for job records, API keys, and cost logs.
Reuses a stack you already know well instead of introducing Postgres/Redis for what is,
at this scale, a handful of small tables.

**API design: shaped after Golpo's own v2 API**, deliberately — it's a proven, sensible
contract and the explicit ask was "similar to Golpo." Async job model (`POST .../generate`
returns a `job_id` immediately; poll `GET .../videos/{id}` for status and the result
URL), `x-api-key` header auth, a `{ detail }` error body, and the same status-code
vocabulary (400/401/403/404/413/422/429/500). Version the contract from day one
(`/v1/...`) even with one caller.

**Cost telemetry is a first-class feature, not an afterthought.** Every job records
real, itemized cost (TTS characters and $, render seconds and $, any LLM-planning
tokens and $) to its job record. This is not optional instrumentation — "compete with
Golpo below $1/video" is a claim that needs real measured data behind it before Phase 5
ever prices a public plan, not an estimate carried over from this conversation.

**Image generation is swappable, cached, and never the planner's guess.** Illustration
comes from a real `ImageProvider` interface (Phase 4) with two real implementations —
never hardcode a single vendor's SDK call into the pipeline. Every generated image is
content-addressably cached (provider + style + concept → R2 object), because repeat
concepts across topics are common and regenerating them is pure waste. The scene
planner may request an illustration by describing what it wants (`imageConcept`); it
never fabricates an image URL itself. As of the Phase 4 asset-library amendment, most
character/prop illustration is sourced from a pre-built, reusable asset registry rather
than generated live per render — see `shui-wg-phase-04-amendment-asset-library.md`.

**Security.** No secret (TTS API key, LLM API key, image-provider API keys, R2
credentials, the WG API key itself) ever lives in a repo, a Docker image layer, or a
client. GCP Secret Manager for everything, same discipline Shui's own `functions/`
package already established.

**Testing.** Every phase ends with a real, working artifact you can point at and run —
not a design document. Unit tests for pure logic (cost calculation, scene-timing math,
request validation). No snapshot tests of rendered video frames; visual QA is a human
watching the output.

## Phase order

| # | File | Delivers |
|---|------|----------|
| 0 | `shui-wg-phase-00-foundation.md` | Repo scaffold, GCP project, one hardcoded scene rendering to a real MP4 locally |
| 1 | `shui-wg-phase-01-render-pipeline.md` | The real pipeline: scene schema, component library, TTS with timing, compositing, cost telemetry |
| 2 | `shui-wg-phase-02-api-surface.md` | The Golpo-shaped REST API, async jobs, auth, deployed and callable over the network |
| 3 | `shui-wg-phase-03-style-library.md` | Visual variety (multiple styles), the script-only convenience path via an internal scene-planning step |
| 4 | `shui-wg-phase-04-illustration-engine.md` | Real drawings and figures, not just text — two swappable image providers (Recraft vector, Flux raster), content-addressable caching, planner support for `imageConcept`, and a real side-by-side cost/quality comparison. **Amended** — see `shui-wg-phase-04-amendment-asset-library.md`, which supersedes live-per-render generation with a reusable asset library. |
| 5 | `shui-wg-phase-05-productization-roadmap.md` | **Not a build phase.** What "public, on tri-nham.com, competing with Golpo" requires, and the trigger condition for starting it |
| 6 | `shui-wg-phase-06-teaching-methodology.md` | The locked reference for *why* a video teaches, not just how it looks — nine retention/teaching techniques for adult learners, each mapped to what's already built vs. what still needs a planner-prompt change. Companion to `shui-wg-phase-04-revision-3-design-system.md` (that doc is "how it looks," this one is "why it sticks"). |

Phase 4 exists because Phases 0-3, as originally specified, only ever produced
typographic video (title cards, bullet lists, timelines) — the planner was explicitly
told not to reference images, since none were available. That shipped exactly as
specified and was correctly judged as not good enough for a "whiteboard video" product;
Phase 4 is the fix, not an afterthought bolted onto a finished pipeline. Phase 4 was
then itself amended after comparing shipped output directly against Golpo's real
output — see the amendment doc for why live-per-render generation gave way to a
reusable asset library.

Once Phase 0-4 are live and Shui's own content is genuinely rendering through Shui WG
in production — with real illustrations, not just text — go back to the main Shui repo
and run `prompts/shui-app-phase-07-batch-creation.md` — that's the feature that
actually connects the two.
