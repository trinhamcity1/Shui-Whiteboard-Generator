# Phase 4 — Productization roadmap (not a build phase)

## Do not start this phase yet

This is a design-constraints document, written now so phases 0-3 don't accidentally
make a decision that requires a rewrite later — not an instruction to start building a
public product. The trigger condition for actually starting this phase:

**Shui itself has been generating real content through Shui WG in production for a
meaningful stretch, and the cost telemetry from Phase 1-2 shows real, sustained numbers
— not an estimate, not a lab test, actual production data across dozens of real
videos.** Until that's true, any pricing or capacity decision made here would be a
guess dressed up as a plan, the same mistake flagged earlier in this project's own
planning around the creator marketplace idea: don't build supply/monetization
infrastructure for a demand signal you don't have evidence of yet.

## What "public, on tri-nham.com, competing with Golpo below $1/video" actually requires

**Self-serve signup and API key issuance.** A real account system (even a minimal one —
email + a generated key, no need for the full weight of Shui's own Firebase Auth setup)
and a self-service flow to create, view, and revoke keys. Phase 2 already stores keys
as `{ ownerLabel, hashedKey }` records for exactly this reason — this phase adds the
UI and auth around creating them without your manual intervention.

**Billing, tied directly to the cost telemetry already being recorded.** Usage-based
pricing, metered per job, using the *real* `JobCost.totalCostUsd` numbers Phase 1-2
have been logging all along — not a number picked in advance. Stripe (usage-based
billing, metered subscriptions) is the standard fit here. Price with real margin over
the measured cost, not the projected cost from this planning conversation.

**A public docs site**, hosted at a `tri-nham.com` subdomain via Firebase Hosting. This
is close to free to build once the API itself is stable — the API reference is close to
"generate this from the same Zod schemas already backing the API," not a separate
writing project.

**Rate limiting tuned for real strangers**, not the generous internal-only defaults from
Phase 2. Free-tier abuse (someone hammering the API to generate large volumes of video
against your GCP bill with no intent to pay) is a real risk the moment this is public
that simply doesn't exist with one trusted internal caller — plan for it explicitly
rather than discovering it live.

**Some minimum content-safety check.** A fully public "type anything, get a rendered
video" API run under your own name and billed to your own GCP account needs at least a
basic policy (a content-moderation pass on submitted scripts, a clear ToS, a way to
suspend an abusive key) before it's genuinely safe to open up. This is a smaller version
of the same UGC-moderation problem Shui's own comments feature already had to solve for
App Store review — the lesson transfers directly: reporting and blocking must be real,
not decorative.

**Capacity planning for real concurrent load.** Phase 2's Cloud Run setup was sized for
Shui's own batch jobs, not unpredictable public traffic. Revisit concurrency limits,
Cloud Tasks queue configuration, and Cloud Run's autoscaling settings against real
public-traffic assumptions once this phase actually starts.

## What this phase deliberately does not decide in advance

Pricing tiers, free-tier limits, which style variants ship publicly, and whether this
ever becomes a standalone business versus staying a Shui-only cost-saving tool that
happens to be architected cleanly enough to open up. Those are real decisions that
should be made with real usage data in hand, not guessed at here. The only thing this
document commits to is that phases 0-3 shouldn't make the *architecture* choices that
would make those later decisions harder than they need to be — which is why API-key
auth, versioned endpoints, and per-job cost telemetry are already real in Phase 2, not
retrofitted here.
