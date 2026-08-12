# Phase 5 — Productization roadmap (not a build phase)

## Do not start this phase yet

This is a design-constraints document, written now so phases 0-4 don't accidentally
make a decision that requires a rewrite later — not an instruction to start building a
public product. The trigger condition for actually starting this phase:

**Shui itself has been generating real content through Shui WG in production for a
meaningful stretch, using the real illustration engine from Phase 4 — specifically the
asset-library direction from `shui-wg-phase-04-amendment-asset-library.md`, not the
original per-render live-generation approach — and the shared asset library has grown
broad and polished enough that a stranger with an arbitrary topic, not just Shui's own
content, could get a good-looking video out of it.** Cost telemetry across dozens of
real videos should show real, sustained numbers, not an estimate. Until both are true,
any pricing or capacity decision made here would be a guess dressed up as a plan, the
same mistake flagged earlier in this project's own planning around the creator
marketplace idea: don't build supply/monetization infrastructure for a demand signal
you don't have evidence of yet.

## The product, restated

Once this phase starts, Shui WG stops being an internal cost-saving tool and becomes
its own product: a public website at `tri-nham.com`, in the same category as Flux,
Recraft, or Golpo itself — somewhere a stranger can land, explore what it makes, sign
up, generate a whiteboard-style explainer video, and integrate via API if they want to
build on it programmatically. Pricing gets figured out once real usage data exists
(explicitly not decided in this document) — the scope, not the price, is what's locked
down here.

## The illustration strategy for a public product: grow the shared library, don't generate per customer

This is the one architectural question the Phase 4 amendment raises that the original
version of this document never had to answer. Shui's own asset library (a narrator plus
a civics-specific cast) is cheap because it's *reused* — but a stranger signing up to
make a video about their bakery, their crypto project, or their own training material
isn't served by a civics-flavored library. The answer isn't "generate something custom
for every stranger" (reintroduces the live-generation cost and the text-in-diagram
reliability problem Phase 4's amendment specifically moved away from) and it isn't "only
serve Shui's own topics" either. It's to make the shared library itself broad enough
that most real requests are already covered by something in it — the same strategy
established whiteboard/explainer-video tools (Vyond, Doodly, VideoScribe) actually use:
large curated libraries of reusable characters and props, not fresh AI art per video.
It's also exactly what the Golpo reference frame itself turned out to be doing.

**A genuinely broad v1 library, scoped in three tiers:**

| Tier | Covers | Rough size | Est. cost (blended Recraft/Flux) |
|---|---|---|---|
| Universal | Every video, any customer, any topic — narrator character(s) in multiple poses, generic props (arrows, checkmarks, charts, common objects) | ~5 narrator identities × 7 poses (35) + ~60 generic props | ~$4.75 |
| Vertical | The handful of explainer-video categories that show up across *any* audience, not just Shui's own — business/corporate, education, health/medical, tech/startup, finance | ~5 verticals × ~10 assets each (50) | ~$2.50–4.00 |
| Shui-specific | Shui's own content categories, built as they become real (civics first) | ~9 assets for civics now, more added on demand | ~$0.50 |

**Total: roughly 150-160 assets, roughly $8-15 in one-time generation cost.** Even a
library broad enough to plausibly cover most explainer-video requests stays a rounding
error next to what a single month of Golpo credits costs. The real cost isn't
generation spend — it's curation time: choosing what the library needs to contain,
regenerating and picking the best result per asset, and keeping the whole set visually
consistent. That curation work is worth investing real care into, since every asset in
it gets amortized across every future video, both Shui's own and every future paying
customer's. "Polish the library" is the actual v1 illustration workstream, not a
premium-tier feature.

Per-customer custom illustration (a topic the shared library genuinely can't cover) is
explicitly **not** a v1 requirement. It's a real future option — either as a paid,
manual onboarding step (a small custom character pack built for a specific customer,
the same way Shui's own civics set was built) or by reviving the original live-generation
`ImageProvider` path from Phase 4 as a premium, metered tier — but deciding which, and
whether it's needed at all, waits for real signal that customers are actually asking
for topics the library can't serve. Don't build it speculatively.

## What "public, on tri-nham.com" actually requires

**A real public website, not just API docs.** The original scope here undersold this —
"similar to Flux, Golpo, or Recraft, with API integration" means an actual site: sign
up, a dashboard, an in-browser flow to type a script (or pick a topic) and generate a
video, a way to browse/preview what the library can produce before committing, project
and video management, and — for developers who want to integrate directly — API key
management and reference docs generated from the same Zod schemas already backing the
API. The API-only Phase 2 surface is the back end for all of this, not a substitute for
it.

**Self-serve signup and API key issuance.** A real account system (even a minimal one —
email + a generated key, no need for the full weight of Shui's own Firebase Auth setup)
and a self-service flow to create, view, and revoke keys, surfaced in the website above.
Phase 2 already stores keys as `{ ownerLabel, hashedKey }` records for exactly this
reason.

**Billing, tied directly to the cost telemetry already being recorded.** Now genuinely
simpler than originally scoped: with the asset-library approach, marginal cost per
video for anything the library covers approaches $0, which makes flat or simple tiered
pricing far more viable than Golpo's metered-per-minute model — a real strategic
advantage worth designing pricing around once there's usage data, not before.

**Rate limiting tuned for real strangers**, not the generous internal-only defaults from
Phase 2. The biggest abuse risk shifts with this direction: it's less about runaway
per-job image-generation spend (the library approach mostly eliminates that) and more
about render-compute abuse (someone spinning up large volumes of Cloud Run renders) —
plan for that explicitly.

**Some minimum content-safety check.** A fully public "generate a video" site run under
your own name and billed to your own GCP account needs at least a basic policy (script
moderation, a clear ToS, a way to suspend an abusive key) before it's genuinely safe to
open up — the same UGC-moderation discipline Shui's own comments feature already had to
solve for App Store review.

**Capacity planning for real concurrent load.** Phase 2's Cloud Run setup was sized for
Shui's own batch jobs, not unpredictable public traffic. Revisit concurrency limits,
Cloud Tasks queue configuration, and Cloud Run's autoscaling settings against real
public-traffic assumptions once this phase actually starts.

## What this phase deliberately does not decide in advance

Pricing tiers, free-tier limits, which style variants ship publicly, whether and when
per-customer custom illustration or live generation ever becomes a paid premium tier,
and whether this ever becomes a standalone business versus staying a Shui-only
cost-saving tool that happens to be architected cleanly enough to open up. Those are
real decisions that should be made with real usage data in hand, not guessed at here.
The only thing this document commits to is that phases 0-4 shouldn't make the
*architecture* choices that would make those later decisions harder than they need to
be — which is why API-key auth, versioned endpoints, per-job cost telemetry, and a
swappable image-provider interface are already real by the end of Phase 4, and why the
asset library is being built broad enough from the start to plausibly serve strangers,
not retrofitted here.
