"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getStoredApiKey } from "@/lib/auth";
import { fetchAccount, cancelSubscription, type AccountResponse } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredApiKey();
    if (!stored) {
      router.push("/signin");
      return;
    }
    setApiKey(stored);
    fetchAccount(stored)
      .then(setAccount)
      .catch(() => router.push("/signin"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleCancel() {
    if (!apiKey) return;
    setCancelling(true);
    try {
      const result = await cancelSubscription(apiKey);
      setAccount((prev) => (prev ? { ...prev, tier: result.tier, tierName: result.tierName } : prev));
      setConfirmOpen(false);
      setMessage(
        "Your subscription is cancelled — you're back on Siltstone (pay-as-you-go). Your credit balance and video history are unchanged.",
      );
    } finally {
      setCancelling(false);
    }
  }

  if (loading || !account) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 px-6 py-16 text-center text-sm text-ink-faint">Loading…</main>
        <Footer />
      </div>
    );
  }

  const isPaidPlan = account.tier !== "siltstone";

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-6 py-12">
          <div className="mb-8 flex items-center gap-3">
            <Link href="/dashboard" className="text-sm font-semibold text-ink-soft hover:text-ink">
              ← Dashboard
            </Link>
          </div>
          <h1 className="font-display text-3xl font-semibold text-ink">Settings</h1>

          <div className="mt-8 rounded-2xl border border-line bg-paper-raised p-6">
            <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">Current plan</p>
            <p className="font-display mt-1 text-2xl font-semibold text-ink">{account.tierName}</p>
            <p className="mt-1 text-sm text-ink-soft">Credit balance: {account.creditBalance.toFixed(2)}</p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/pricing"
                className="rounded-full border border-ink px-4 py-2 text-sm font-semibold text-ink transition hover:bg-ink hover:text-paper"
              >
                Change plan
              </Link>
              {isPaidPlan && (
                <button
                  onClick={() => setConfirmOpen(true)}
                  className="rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-accent transition hover:border-accent"
                >
                  Cancel subscription
                </button>
              )}
            </div>

            {message && <p className="mt-4 text-sm text-ink-soft">{message}</p>}

            {!isPaidPlan && (
              <p className="mt-4 text-sm text-ink-faint">
                You&apos;re on pay-as-you-go — there&apos;s no subscription to cancel.
              </p>
            )}
          </div>
        </div>
      </main>

      {confirmOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-ink/40 px-6">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-paper-raised p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Cancel {account.tierName}?</h2>
            <p className="mt-2 text-sm text-ink-soft">
              You&apos;ll move to Siltstone (pay-as-you-go) immediately. Your credit balance and video library stay
              exactly as they are — you just won&apos;t be billed monthly anymore, and features specific to{" "}
              {account.tierName} (like {account.topicCreditsPerMinute === null ? "the web dashboard" : "topic mode"})
              will no longer be available until you resubscribe.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="rounded-full px-4 py-2 text-sm font-semibold text-ink-soft hover:text-ink"
              >
                Never mind
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:opacity-90 disabled:opacity-60"
              >
                {cancelling ? "Cancelling…" : "Yes, cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
