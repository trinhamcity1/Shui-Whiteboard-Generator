import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { fetchPricing, type TierConfig } from "@/lib/api";

const TIER_ACCENT: Record<TierConfig["id"], string> = {
  siltstone: "bg-siltstone",
  obsidian: "bg-obsidian",
  alabaster: "bg-alabaster",
  pyramidion: "bg-pyramidion",
};

const TIER_BLURB: Record<TierConfig["id"], string> = {
  siltstone: "Pay-as-you-go. No subscription, credits never expire.",
  obsidian: "The simplest way to get started with the web dashboard.",
  alabaster: "Full access: web dashboard plus the API, at a discount.",
  pyramidion: "Everything, plus your own custom illustration style.",
};

function formatCredits(tier: TierConfig): string {
  if (tier.monthlyPriceUsd === null) return "$1 in = 1 credit";
  return `${tier.monthlyCredits} credits / month`;
}

export default async function PricingPage() {
  let tiers: TierConfig[] = [];
  let echo: { trainCredits: number; retrainCredits: number } | null = null;
  let loadError = false;
  try {
    const data = await fetchPricing();
    tiers = data.tiers;
    echo = data.echo;
  } catch {
    loadError = true;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 pt-16 pb-10 text-center">
          <h1 className="font-display text-4xl font-semibold text-ink sm:text-5xl">Pricing</h1>
          <p className="mx-auto mt-4 max-w-xl text-ink-soft">
            Every plan bills in credits. 1 credit is worth $1 of generation — subscription plans buy credits in bulk
            at a discount.
          </p>
        </section>

        {loadError ? (
          <p className="mx-auto max-w-6xl px-6 pb-24 text-center text-ink-soft">
            Couldn&apos;t load live pricing right now — please refresh.
          </p>
        ) : (
          <section className="mx-auto max-w-6xl px-6 pb-16">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {tiers.map((tier) => (
                <div
                  key={tier.id}
                  className="flex flex-col rounded-2xl border border-line bg-paper-raised p-6 shadow-sm"
                >
                  <span className={`h-2 w-10 rounded-full ${TIER_ACCENT[tier.id]}`} />
                  <h2 className="font-display mt-4 text-xl font-semibold text-ink">{tier.name}</h2>
                  <p className="mt-1 text-sm text-ink-soft">{TIER_BLURB[tier.id]}</p>

                  <div className="mt-6">
                    <span className="font-display text-3xl font-semibold text-ink">
                      {tier.monthlyPriceUsd === null ? "Pay per minute" : `$${tier.monthlyPriceUsd}`}
                    </span>
                    {tier.monthlyPriceUsd !== null && <span className="text-sm text-ink-soft"> / month</span>}
                  </div>
                  <p className="mt-1 text-sm text-ink-faint">{formatCredits(tier)}</p>

                  <ul className="mt-6 flex-1 space-y-3 text-sm text-ink-soft">
                    <li>
                      <strong className="text-ink">${tier.baseCreditsPerMinute.toFixed(2)}</strong>/min — your own
                      script
                    </li>
                    <li>
                      {tier.topicCreditsPerMinute === null ? (
                        <span className="text-ink-faint">Topic mode not included</span>
                      ) : (
                        <>
                          <strong className="text-ink">${tier.topicCreditsPerMinute.toFixed(2)}</strong>/min — topic
                          only
                        </>
                      )}
                    </li>
                    <li>Up to {tier.maxLengthMinutes} min videos</li>
                    <li>{tier.verticalOnly ? "Vertical video only" : "Vertical or horizontal"}</li>
                    <li>
                      {tier.uiAccess && tier.apiAccess
                        ? "Web dashboard + API"
                        : tier.uiAccess
                          ? "Web dashboard only"
                          : "API only, no web dashboard"}
                    </li>
                    {tier.echoAccess && <li className="font-semibold text-ink">Echo custom style included</li>}
                  </ul>

                  <Link
                    href="/signup"
                    className="mt-6 rounded-full border border-ink px-4 py-2 text-center text-sm font-semibold text-ink transition hover:bg-ink hover:text-paper"
                  >
                    Choose {tier.name}
                  </Link>
                </div>
              ))}
            </div>

            {echo && (
              <div className="mt-10 rounded-2xl border border-line bg-paper-raised p-6 text-sm text-ink-soft">
                <p>
                  <strong className="text-ink">Echo custom style</strong> (Pyramidion only): train your own
                  illustration style from 5–10 reference images for{" "}
                  <strong className="text-ink">{echo.trainCredits} credits</strong> (~$20), or retrain an existing
                  model for <strong className="text-ink">{echo.retrainCredits} credits</strong> (~$10).
                </p>
              </div>
            )}
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
