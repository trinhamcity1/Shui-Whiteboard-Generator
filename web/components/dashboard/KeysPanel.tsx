"use client";

import { useEffect, useState } from "react";
import { createKey, fetchKeys, revokeKey, type ApiKeySummary } from "@/lib/api";

export function KeysPanel({ apiKey }: { apiKey: string }) {
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const { items } = await fetchKeys(apiKey);
      setKeys(items);
    } catch {
      setError("Couldn't load API keys.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    setError(null);
    try {
      const result = await createKey(apiKey);
      setNewKey(result.apiKey);
      await refresh();
    } catch {
      setError("Couldn't create a new key.");
    }
  }

  async function handleRevoke(id: string) {
    setError(null);
    try {
      await revokeKey(apiKey, id);
      await refresh();
    } catch {
      setError("Couldn't revoke that key.");
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-paper-raised p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink">API keys</h2>
        <button
          onClick={handleCreate}
          className="rounded-full border border-ink px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-ink hover:text-paper"
        >
          New key
        </button>
      </div>

      {newKey && (
        <div className="mt-4 rounded-lg border border-line-strong bg-paper p-3">
          <p className="text-xs font-semibold text-ink-soft">Save this now — it won&apos;t be shown again:</p>
          <code className="mt-1 block text-xs break-all text-ink">{newKey}</code>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-accent">{error}</p>}

      <div className="mt-4 divide-y divide-line">
        {loading ? (
          <p className="py-3 text-sm text-ink-faint">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="py-3 text-sm text-ink-faint">No keys yet.</p>
        ) : (
          keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between py-3">
              <div>
                <code className="text-sm text-ink">…{k.keyPreview}</code>
                <p className="text-xs text-ink-faint">
                  {k.isActive ? "Active" : "Revoked"} · created {new Date(k.createdAt).toLocaleDateString()}
                </p>
              </div>
              {k.isActive && (
                <button
                  onClick={() => handleRevoke(k.id)}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  Revoke
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
