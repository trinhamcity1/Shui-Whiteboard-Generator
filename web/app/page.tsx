import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const STEPS = [
  {
    n: "01",
    title: "Give it a topic",
    body: "Type one line — \"how to best rescue a drowning person\" — and the system writes a full narration script for you.",
  },
  {
    n: "02",
    title: "It plans the visuals",
    body: "Every beat of the script gets matched to a hand-drawn illustration, diagram, or on-screen graphic — automatically.",
  },
  {
    n: "03",
    title: "Get a finished video",
    body: "Real narration audio, synced whiteboard-style visuals, ready to download in a couple of minutes.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
          <div className="max-w-2xl">
            <p className="mb-5 inline-block rounded-full border border-line-strong px-3 py-1 text-xs font-semibold tracking-wide text-ink-soft uppercase">
              Now in early access
            </p>
            <h1 className="font-display text-5xl leading-[1.05] font-semibold text-balance text-ink sm:text-6xl">
              Turn a topic into a narrated whiteboard video.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
              Shui-WG writes the script, draws the illustrations, and voices the narration —
              a complete explainer video from a single sentence, or bring your own script for full control.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/signup"
                className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-ink transition hover:opacity-90"
              >
                Start free
              </Link>
              <Link href="/pricing" className="text-sm font-semibold text-ink underline underline-offset-4">
                See pricing
              </Link>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-paper-raised">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="grid gap-10 sm:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.n}>
                  <div className="font-display text-3xl font-semibold text-accent">{step.n}</div>
                  <h3 className="mt-3 text-lg font-semibold text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid items-center gap-12 sm:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-semibold text-ink">
                Two ways to work, depending on how much you want to write yourself.
              </h2>
              <ul className="mt-6 space-y-4 text-ink-soft">
                <li className="flex gap-3">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>
                    <strong className="text-ink">Bring your own script.</strong> Shui-WG follows it word for word and
                    only handles the visuals — the base plan.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>
                    <strong className="text-ink">Just give a topic.</strong> The advanced plan writes the narration
                    for you too, start to finish.
                  </span>
                </li>
              </ul>
            </div>
            <div
              aria-hidden
              className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-sm"
            >
              <div className="absolute inset-0 flex flex-col justify-between p-6">
                <div className="flex gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-ink-faint/40" />
                  <span className="h-2.5 w-2.5 rounded-full bg-ink-faint/40" />
                  <span className="h-2.5 w-2.5 rounded-full bg-ink-faint/40" />
                </div>
                <svg viewBox="0 0 200 100" className="mx-auto h-24 w-auto stroke-ink" fill="none" strokeWidth="2">
                  <circle cx="100" cy="35" r="18" />
                  <path d="M100 53 L100 80 M85 65 L115 65 M100 80 L85 100 M100 80 L115 100" />
                </svg>
                <div className="mx-auto h-2 w-2/3 rounded-full bg-line-strong" />
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-line bg-paper-raised">
          <div className="mx-auto max-w-6xl px-6 py-16 text-center">
            <h2 className="font-display text-3xl font-semibold text-ink">Ready to try it?</h2>
            <p className="mx-auto mt-3 max-w-md text-ink-soft">
              Sign up free, then pay only for the minutes you generate — starting at $1/minute.
            </p>
            <Link
              href="/signup"
              className="mt-7 inline-block rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper transition hover:bg-accent"
            >
              Create your account
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
