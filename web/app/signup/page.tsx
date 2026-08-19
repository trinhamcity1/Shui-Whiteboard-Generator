"use client";

import { useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { signup, ApiRequestError } from "@/lib/api";
import { setStoredApiKey } from "@/lib/auth";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");
    try {
      const result = await signup(email);
      setApiKey(result.apiKey);
      setStoredApiKey(result.apiKey);
      setStatus("done");
    } catch (err) {
      setError(err instanceof ApiRequestError ? String(err.detail ?? err.message) : "Something went wrong.");
      setStatus("idle");
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          {status === "done" && apiKey ? (
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink">You&apos;re in.</h1>
              <p className="mt-2 text-sm text-ink-soft">
                Here&apos;s your API key — save it now, it won&apos;t be shown again. It&apos;s also saved to this
                browser for the dashboard.
              </p>
              <div className="mt-5 rounded-lg border border-line-strong bg-paper-raised p-4">
                <code className="block text-xs break-all text-ink">{apiKey}</code>
              </div>
              <Link
                href="/dashboard"
                className="mt-6 block rounded-full bg-ink px-4 py-3 text-center text-sm font-semibold text-paper transition hover:bg-accent"
              >
                Go to dashboard
              </Link>
            </div>
          ) : (
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink">Create your account</h1>
              <p className="mt-2 text-sm text-ink-soft">Just an email — no password to set.</p>

              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  disabled
                  title="Coming soon — sign up with email below for now"
                  className="flex items-center justify-center gap-2 rounded-full border border-line-strong px-4 py-2.5 text-sm font-medium text-ink-faint"
                >
                  Continue with Google
                </button>
                <button
                  type="button"
                  disabled
                  title="Coming soon — sign up with email below for now"
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
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-lg border border-line-strong bg-paper-raised px-4 py-2.5 text-sm text-ink outline-none focus:border-ink"
                />
                {error && <p className="text-sm text-accent">{error}</p>}
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-paper transition hover:bg-accent disabled:opacity-60"
                >
                  {status === "loading" ? "Creating account…" : "Sign up with email"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-ink-soft">
                Already have an API key?{" "}
                <Link href="/signin" className="font-semibold text-ink underline underline-offset-4">
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
