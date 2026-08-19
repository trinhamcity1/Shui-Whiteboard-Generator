"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { AccountCard } from "@/components/dashboard/AccountCard";
import { KeysPanel } from "@/components/dashboard/KeysPanel";
import { LedgerPanel } from "@/components/dashboard/LedgerPanel";
import { GenerateForm } from "@/components/dashboard/GenerateForm";
import { JobsList } from "@/components/dashboard/JobsList";
import { EchoPanel } from "@/components/dashboard/EchoPanel";
import { getStoredApiKey, clearStoredApiKey } from "@/lib/auth";
import { fetchAccount, fetchEchoModels, type AccountResponse, type EchoModelSummary } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [echoModels, setEchoModels] = useState<EchoModelSummary[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadAccount = useCallback(async (key: string) => {
    const acc = await fetchAccount(key);
    setAccount(acc);
    if (acc.echoAccess) {
      const { items } = await fetchEchoModels(key);
      setEchoModels(items);
    }
  }, []);

  useEffect(() => {
    const stored = getStoredApiKey();
    if (!stored) {
      router.push("/signin");
      return;
    }
    setApiKey(stored);
    loadAccount(stored)
      .catch(() => router.push("/signin"))
      .finally(() => setLoading(false));
  }, [router, loadAccount]);

  function handleSignOut() {
    clearStoredApiKey();
    router.push("/");
  }

  if (loading || !apiKey || !account) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 px-6 py-16 text-center text-sm text-ink-faint">Loading your dashboard…</main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="font-display text-3xl font-semibold text-ink">Dashboard</h1>
            <button onClick={handleSignOut} className="text-sm font-semibold text-ink-soft hover:text-ink">
              Sign out
            </button>
          </div>

          <div className="flex flex-col gap-6">
            <AccountCard account={account} />

            {account.uiAccess ? (
              <>
                <GenerateForm
                  apiKey={apiKey}
                  account={account}
                  echoModels={echoModels}
                  onQueued={() => setRefreshKey((k) => k + 1)}
                />
                <JobsList apiKey={apiKey} refreshKey={refreshKey} />
              </>
            ) : (
              <div className="rounded-2xl border border-line bg-paper-raised p-6 text-sm text-ink-soft">
                <p>
                  Siltstone is API-only — there&apos;s no generate-here form. Call{" "}
                  <code className="text-ink">POST /v1/videos/generate</code> directly; see the{" "}
                  <Link href="/docs" className="font-semibold text-ink underline underline-offset-4">
                    API docs
                  </Link>{" "}
                  for the request shape.
                </p>
              </div>
            )}

            <LedgerPanel apiKey={apiKey} />

            {account.echoAccess && (
              <EchoPanel apiKey={apiKey} models={echoModels} onChange={() => loadAccount(apiKey)} />
            )}
            <KeysPanel apiKey={apiKey} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
