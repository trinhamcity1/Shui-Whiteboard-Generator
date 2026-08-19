"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { fetchAccount, ApiRequestError } from "@/lib/api";
import { setStoredApiKey } from "@/lib/auth";

export default function SigninPage() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await fetchAccount(key.trim()); // validates the key is real before storing it
      setStoredApiKey(key.trim());
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiRequestError && err.status === 401
          ? "That API key isn't valid or has been revoked."
          : "Couldn't reach the server — try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-2xl font-semibold text-ink">Sign in</h1>
          <p className="mt-2 text-sm text-ink-soft">
            There&apos;s no password — sign in with the API key from your dashboard.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              disabled
              title="Coming soon — sign in with your API key below for now"
              className="flex items-center justify-center gap-2 rounded-full border border-line-strong px-4 py-2.5 text-sm font-medium text-ink-faint"
            >
              Continue with Google
            </button>
            <button
              type="button"
              disabled
              title="Coming soon — sign in with your API key below for now"
              className="flex items-center justify-center gap-2 rounded-full border border-line-strong px-4 py-2.5 text-sm font-medium text-ink-faint"
            >
              Continue with Apple
            </button>
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-ink-faint">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="text"
              required
              placeholder="swg_…"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="rounded-lg border border-line-strong bg-paper-raised px-4 py-2.5 font-mono text-sm text-ink outline-none focus:border-ink"
            />
            {error && <p className="text-sm text-accent">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-paper transition hover:bg-accent disabled:opacity-60"
            >
              {loading ? "Checking…" : "Sign in with API key"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-soft">
            No account yet?{" "}
            <Link href="/signup" className="font-semibold text-ink underline underline-offset-4">
              Sign up
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
