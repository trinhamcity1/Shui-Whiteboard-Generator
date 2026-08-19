"use client";

import { useEffect, useState } from "react";
import { fetchLedger, type LedgerEntry } from "@/lib/api";

export function LedgerPanel({ apiKey }: { apiKey: string }) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLedger(apiKey)
      .then(({ items }) => setEntries(items))
      .finally(() => setLoading(false));
  }, [apiKey]);

  return (
    <div className="rounded-2xl border border-line bg-paper-raised p-6">
      <h2 className="font-display text-lg font-semibold text-ink">Transactions</h2>

      <div className="mt-4 divide-y divide-line">
        {loading ? (
          <p className="py-3 text-sm text-ink-faint">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="py-3 text-sm text-ink-faint">No transactions yet.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm text-ink">{entry.reason}</p>
                <p className="text-xs text-ink-faint">{new Date(entry.createdAt).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${entry.type === "credit" ? "text-ink" : "text-accent"}`}>
                  {entry.type === "credit" ? "+" : "-"}
                  {entry.amount.toFixed(2)}
                </p>
                <p className="text-xs text-ink-faint">balance {entry.balanceAfter.toFixed(2)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
